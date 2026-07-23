import { AutomationFlow, AutomationExecution, Contact, EcommerceOrder, Message, WhatsappPhoneNumber, Template, Tag, ContactTag, ChatAssignment, Chatbot } from '../models/index.js';
import unifiedWhatsAppService from '../services/whatsapp/unified-whatsapp.service.js';
import { getSheetsClient, getCalendarClient, handleGoogleApiError } from './google-api-helper.js';
import { PROVIDER_TYPES } from '../services/whatsapp/unified-whatsapp.service.js';
import appointmentService from '../services/appointment.service.js';
import automationCache from './automation-cache.js';
import { scheduleDelayedResume, scheduleReplyTimeout, cancelDelayedResume } from '../queues/automation-scheduler-queue.js';
import { v4 as uuidv4 } from 'uuid';

class AutomationEngine {
  constructor() {
    this.runningExecutions = new Map();
    this.eventListeners = new Map();
    this.initializeEventListeners();
  }


  initializeEventListeners() {
    this.eventListeners.set('message_received', this.handleMessageReceived.bind(this));

    this.eventListeners.set('contact_joined', this.handleContactJoined.bind(this));
    this.eventListeners.set('status_update', this.handleStatusUpdate.bind(this));
    this.eventListeners.set('order_received', this.handleOrderReceived.bind(this));

    console.log('Automation engine event listeners initialized:', Array.from(this.eventListeners.keys()));
  }

  async handleOrderReceived(eventData) {
    try {
      console.log("=====================handleOrderReceived called", eventData);
      const { userId } = eventData;

      let contact = null;
      try {
        if (eventData.contactId) {
          contact = await Contact.findOne({
            _id: eventData.contactId,
            created_by: userId,
            deleted_at: null
          }).lean();
        }
      } catch (contactErr) {
        console.warn('Failed to load contact for order_received:', contactErr.message);
      }

      const triggers = await automationCache.getUserActiveFlows(userId);
      console.log(`Found ${triggers.length} triggers for user ${userId}`);

      const orderTriggers = triggers.filter(t => t.event_type === 'order_received');
      console.log(`Found ${orderTriggers.length} order received triggers`);

      for (const trigger of orderTriggers) {
        let flow = automationCache.getFlow(trigger.flow_id.toString());
        if (!flow) {
          flow = await AutomationFlow.findById(trigger.flow_id).populate('user_id');
          if (flow) {
            automationCache.setFlow(trigger.flow_id.toString(), flow);
            console.log(`Loaded flow from DB and cached: ${trigger.flow_id}`);
          }
        }

        if (flow && flow.is_active && !flow.deleted_at) {
          const shouldExecute = this.checkOrderTriggerConditions(flow, eventData);
          console.log(`Should execute order flow: ${shouldExecute}`);
          if (shouldExecute) {
            await this.executeFlow(flow, {
              event_type: 'order_received',
              ...eventData,
              contact,
              timestamp: new Date()
            });
          }
        }
      }
    } catch (error) {
      console.error('Error handling order received event:', error);
    }
  }

  checkOrderTriggerConditions(flow, eventData) {
    const triggers = flow.triggers.filter(t => t.event_type === 'order_received');

    const dataObject = {
      eventType: "orderReceived",
      order_id: eventData.order_id,
      wa_order_id: eventData.wa_order_id,
      wa_message_id: eventData.wa_message_id,
      total_price: eventData.total_price,
      currency: eventData.currency,
      items_count: eventData.items_count,
      senderNumber: eventData.senderNumber,
      recipientNumber: eventData.recipientNumber,
      contactId: eventData.contactId,
      userId: eventData.userId,
      whatsappPhoneNumberId: eventData.whatsappPhoneNumberId
    };

    for (const trigger of triggers) {
      const conditions = trigger.conditions || {};
      if (Object.keys(conditions).length === 0) {
        return true;
      }

      const result = this.evaluateCondition(conditions, dataObject);
      if (result) return true;
    }

    return false;
  }


  async handleMessageReceived(eventData) {
    try {
      console.log("=====================handleMessageReceived called", eventData);
      const { message, senderNumber, recipientNumber, userId, messageType } = eventData;
      const normalizedMessagePayload = this.normalizeMessagePayload(message);

      let contact = null;
      try {
        if (eventData.contactId) {
          contact = await Contact.findOne({
            _id: eventData.contactId,
            created_by: userId,
            deleted_at: null
          }).lean();
        } else if (senderNumber) {
          contact = await Contact.findOne({
            phone_number: senderNumber,
            created_by: userId,
            deleted_at: null
          }).lean();
        }
      } catch (contactErr) {
        console.warn('Failed to load contact for message_received:', contactErr.message);
      }

      const triggers = await automationCache.getUserActiveFlows(userId);
      console.log(`Found ${triggers.length} triggers for user ${userId}`);


      const messageTriggers = triggers.filter((t, i, arr) => t.event_type === 'message_received' && arr.findIndex(tt => String(tt.flow_id) === String(t.flow_id) && tt.event_type === 'message_received') === i);
      console.log(`Found ${messageTriggers.length} message received triggers`);

      // Check for a waiting execution first (wait_for_reply node awaiting reply)
      const waitingExecution = await AutomationExecution.findOne({
        contact_identifier: senderNumber,
        status: 'waiting',
        user_id: userId
      }).sort({ updated_at: -1 });

      if (waitingExecution) {
        console.log(`Found waiting execution ${waitingExecution._id} for ${senderNumber}. Resuming...`);
        const flow = await AutomationFlow.findById(waitingExecution.flow_id).populate('user_id');
        if (flow) {
          return await this.resumeExecution(flow, waitingExecution, eventData, normalizedMessagePayload);
        }
      }

      // Also check for any recent running execution for this contact.
      // If a flow is still processing (e.g. sending messages), don't re-trigger.
      const activeExecution = await AutomationExecution.findOne({
        contact_identifier: senderNumber,
        status: 'running',
        user_id: userId,
        created_at: { $gte: new Date(Date.now() - 5 * 60 * 1000) }
      }).lean();
      if (activeExecution) {
        console.log(`[AutomationEngine] Active running execution ${activeExecution._id} found for ${senderNumber}. Skipping re-trigger.`);
        return;
      }

      for (const trigger of messageTriggers) {
        console.log(`Processing trigger:`, trigger);
        let flow = automationCache.getFlow(trigger.flow_id.toString());
        if (!flow) {
          flow = await AutomationFlow.findById(trigger.flow_id).populate('user_id');
          if (flow) {
            automationCache.setFlow(trigger.flow_id.toString(), flow);
            console.log(`Loaded flow from DB and cached: ${trigger.flow_id}`);
          }
        }

        if (flow && flow.is_active && !flow.deleted_at) {
          console.log(`Checking conditions for flow:`, flow.name);
          const shouldExecute = this.checkMessageTriggerConditions(flow, message, senderNumber, recipientNumber, messageType, null, eventData, normalizedMessagePayload);
          console.log(`Should execute flow: ${shouldExecute}`);
          if (shouldExecute) {
            // Per-contact flow cooldown: prevent the same flow from re-executing
            // for the same sender within 10 minutes.
            // For button/interactive messages from flows WITH specific button conditions
            // (contains ___btn_), skip cooldown. For catch-all flows, ALWAYS enforce cooldown.
            const hasCatchAllTrigger = flow.triggers?.some(t =>
              t.event_type === 'message_received' &&
              (!t.conditions || Object.keys(t.conditions).length === 0)
            );
            const isFlowSpecificButton = !hasCatchAllTrigger && (messageType === 'interactive' || messageType === 'button') && (message && message.toString().includes('___btn_'));
            if (!isFlowSpecificButton) {
              const recentExecution = await AutomationExecution.findOne({
                flow_id: flow._id,
                contact_identifier: senderNumber,
                status: { $in: ['success', 'running', 'waiting'] },
                created_at: { $gte: new Date(Date.now() - 10 * 60 * 1000) }
              }).lean();
              if (recentExecution) {
                console.log(`[AutomationEngine] Flow "${flow.name}" already executed for ${senderNumber} within 10 min (execution: ${recentExecution._id}). Skipping cooldown.`);
                break;
              }
            }

            console.log(`Executing flow: ${flow.name} for message: ${message}`);
            await this.executeFlow(flow, {
              event_type: 'message_received',
              message,
              messagePayload: normalizedMessagePayload,
              senderNumber,
              recipientNumber,
              userId,
              messageType,
              contactId: eventData.contactId || contact?._id?.toString() || null,
              contact,
              whatsappPhoneNumberId: eventData.whatsappPhoneNumberId,
              timestamp: new Date()
            });
            break;
          } else {
            console.log(`Flow conditions not met for: ${flow.name}`);
          }
        } else {
          console.log(`Flow not active or deleted:`, flow?.name);
        }
      }
    } catch (error) {
      console.error('Error handling message received event:', error);
    }
  }


  checkMessageTriggerConditions(flow, message, senderNumber, recipientNumber, messageType, messageId, eventData = null, messagePayload = null) {
    console.log(`Checking conditions for flow: ${flow.name}`, { message, senderNumber, recipientNumber, messageType });
    const triggers = flow.triggers.filter(t => t.event_type === 'message_received');
    console.log(`Found ${triggers.length} message received triggers in flow`);

    const dataObject = {
      message: message || messageId,
      messagePayload: messagePayload || this.normalizeMessagePayload(message || messageId),
      senderNumber,
      recipientNumber,
      messageType,
      eventType: "messageReceived"
    };

    if (eventData && eventData.whatsappPhoneNumberId) {
      dataObject.whatsappPhoneNumberId = eventData.whatsappPhoneNumberId;
    }

    for (const trigger of triggers) {
      const conditions = trigger.conditions || {};
      console.log(`Checking conditions:`, conditions);

      if (Object.keys(conditions).length === 0) {
        console.log('No conditions specified, triggering flow for all messages');
        return true;
      }

      const result = this.evaluateCondition(conditions, dataObject);

      console.log(`Condition evaluation result: ${result}`);
      if (result) {
        console.log(`All conditions met for flow: ${flow.name}`);
        return true;
      }
    }

    console.log(`No matching triggers found for flow: ${flow.name}`);
    return false;
  }


  async handleContactJoined(eventData) {
    console.log('Contact joined event:', eventData);
  }


  async handleStatusUpdate(eventData) {
    console.log('Status update event:', eventData);
  }


  async executeFlow(flow, inputData) {
    const executionId = uuidv4();
    try {
      const execution = await AutomationExecution.create({
        flow_id: flow._id,
        user_id: flow.user_id._id || flow.user_id,
        status: 'running',
        input_data: inputData,
        // Store contact_identifier immediately so cooldown checks work
        // even if the flow crashes before reaching a wait_for_reply node.
        contact_identifier: inputData.senderNumber || null
      });

      this.runningExecutions.set(executionId, execution._id);

      const result = await this.processWorkflow(flow, execution, inputData);

      if (result.status === 'waiting') {
        return result;
      }

      await AutomationExecution.findByIdAndUpdate(execution._id, {
        status: result.success ? 'success' : 'failed',
        output_data: result.output,
        execution_time: result.executionTime,
        completed_at: new Date(),
        execution_log: result.executionLog
      });

      await this.updateFlowStatistics(flow._id, result.success);

      this.runningExecutions.delete(executionId);
      return result;
    } catch (error) {
      console.error('Error executing automation flow:', error);

      if (executionId) {
        await AutomationExecution.findByIdAndUpdate(
          this.runningExecutions.get(executionId),
          {
            status: 'failed',
            error: error.message,
            completed_at: new Date()
          }
        );
        this.runningExecutions.delete(executionId);
      }

      throw error;
    }
  }


  async processWorkflow(flow, execution, inputData) {
    const startTime = Date.now();
    const executionLog = [];
    let currentData = { ...inputData };

    const startNodes = this.getStartNodes(flow);
    for (const node of startNodes) {

        const nodeResult = await this.executeNode(node, flow, currentData, executionLog);
        if (nodeResult.status === 'waiting') {
          return { success: true, status: 'waiting', output: currentData, executionLog };
        }
        if (nodeResult.success || flow.settings?.error_handling === 'continue') {
          currentData = {
            ...currentData,
            ...nodeResult.output,
            userId: currentData.userId || inputData.userId || inputData.user_id
          };

          const workflowResult = await this.processConnectedNodes(flow, node, currentData, executionLog, inputData);
          if (workflowResult && workflowResult.status === 'waiting') {
            return workflowResult;
          }
        }
      }

    const executionTime = Date.now() - startTime;

    return {
      success: true,
      output: currentData,
      executionTime,
      executionLog
    };
  }


  getStartNodes(flow) {
    const connectedTargets = new Set();
    flow.connections.forEach(conn => {
      connectedTargets.add(conn.target);
    });

    return flow.nodes.filter(node => !connectedTargets.has(node.id) && node.type === 'trigger');
  }


  async processConnectedNodes(flow, currentNode, currentData, executionLog, originalInputData = {}) {
    const nextHandle = currentData.__nextHandle || null;
    if (nextHandle) {
      delete currentData.__nextHandle;
    }

    let connectedNodes = this.getConnectedNodes(flow, currentNode.id, nextHandle);

    // Smart branch selection: When processing trigger node children,
    // if any button/list-specific condition (cond-btn-*, cond-list-*) matches
    // the current message, skip the generic start condition (cond-start-*) to
    // prevent re-sending the welcome message on button/list clicks.
    if (currentNode.type === 'trigger' && connectedNodes.length > 1) {
      const buttonCondNodes = connectedNodes.filter(n =>
        n.type === 'condition' && (n.id.startsWith('cond-btn-') || n.id.startsWith('cond-list-'))
      );

      if (buttonCondNodes.length > 0) {
        const anyButtonMatches = buttonCondNodes.some(n => {
          const condition = n.parameters?.condition;
          if (!condition) return false;
          try {
            return this.evaluateCondition(condition, currentData);
          } catch {
            return false;
          }
        });

        if (anyButtonMatches) {
          console.log('[AutomationEngine] Button/list condition matched — skipping cond-start branches');
          connectedNodes = connectedNodes.filter(n => !n.id.startsWith('cond-start-'));
        }
      }
    }

    for (const node of connectedNodes) {
      const nodeResult = await this.executeNode(node, flow, currentData, executionLog);
      if (nodeResult.status === 'waiting') {
        return { success: true, status: 'waiting', output: currentData, executionLog };
      }
      if (nodeResult.success || flow.settings?.error_handling === 'continue') {
        const updatedData = {
          ...currentData,
          ...nodeResult.output,
          userId: currentData.userId || originalInputData.userId || originalInputData.user_id
        };

        const result = await this.processConnectedNodes(flow, node, updatedData, executionLog, originalInputData);
        if (result && result.status === 'waiting') {
          return result;
        }
      }
    }
  }


  getConnectedNodes(flow, nodeId, sourceHandle = null) {
    const connections = flow.connections.filter(conn => {
      if (conn.source !== nodeId) return false;
      if (sourceHandle && conn.sourceHandle) {
        return conn.sourceHandle === sourceHandle;
      }
      return !sourceHandle;
    });

    const connectedIds = connections.map(conn => conn.target);

    return flow.nodes.filter(node => connectedIds.includes(node.id));
  }


  async executeNode(node, flow, inputData, executionLog) {
    const startTime = Date.now();
    let result = { success: false, output: {} };

    try {
      const nodeLog = {
        node_id: node.id,
        node_type: node.type,
        status: 'running',
        start_time: new Date(),
        input: inputData
      };

      switch (node.type) {
        case 'trigger':
          result = await this.executeTriggerNode(node, inputData);
          break;
        case 'condition':
          result = await this.executeConditionNode(node, inputData);
          break;
        case 'action':
          result = await this.executeActionNode(node, inputData);
          break;
        case 'delay':
          result = await this.executeDelayNode(node, inputData, flow, executionLog);
          break;
        case 'filter':
          result = await this.executeFilterNode(node, inputData);
          break;
        case 'transform':
          result = await this.executeTransformNode(node, inputData);
          break;
        case 'webhook':
          result = await this.executeWebhookNode(node, inputData);
          break;
        case 'ai_response':
          result = await this.executeAIResponseNode(node, inputData);
          break;
        case 'send_message':
          result = await this.executeSendMessageNode(node, inputData);
          break;
        case 'send_template':
          result = await this.executeSendTemplateNode(node, inputData);
          break;
        case 'add_tag':
          result = await this.executeAddTagNode(node, inputData, flow);
          break;
        case 'cta_button':
          result = await this.executeSendCtaNode(node, inputData);
          break;
        case 'assign_chatbot':
          result = await this.executeAssignChatbotNode(node, inputData);
          break;
        case 'save_to_google_sheet':
          result = await this.executeSaveToGoogleSheetNode(node, inputData);
          break;
        case 'create_calendar_event':
          result = await this.executeCreateCalendarEventNode(node, inputData);
          break;
        case 'update_contact':
          result = await this.executeUpdateContactNode(node, inputData);
          break;
        case 'appointment_flow':
          result = await this.executeAppointmentFlowNode(node, flow, inputData, executionLog);
          break;
        case 'wait_for_reply':
          result = await this.executeWaitForReplyNode(node, flow, inputData, executionLog);
          break;
      case 'response_saver':
        result = await this.executeResponseSaverNode(node, inputData);
        break;
      case 'api':
        result = await this.executeApiNode(node, inputData);
        break;
      case 'update_lead_score':
        result = await this.executeUpdateLeadScoreNode(node, inputData);
        break;
        case 'custom':
          result = await this.executeCustomNode(node, inputData);
          break;
        default:
          throw new Error(`Unknown node type: ${node.type}`);
      }

      nodeLog.status = result.success ? 'success' : 'failed';
      nodeLog.output = result.output;
      nodeLog.end_time = new Date();
      nodeLog.error = result.error || null;

      executionLog.push(nodeLog);

      return result;
    } catch (error) {
      const nodeLog = {
        node_id: node.id,
        node_type: node.type,
        status: 'failed',
        start_time: new Date(),
        end_time: new Date(),
        input: inputData,
        output: {},
        error: error.message
      };
      executionLog.push(nodeLog);

      return { success: false, output: {}, error: error.message };
    }
  }


  async executeTriggerNode(node, inputData) {
    return { success: true, output: inputData };
  }


  async executeConditionNode(node, inputData) {
    const { condition, conditions, no_match_handle } = node.parameters || {};

    // Bypass 'cond-start-' conditions for ad referrals so the workflow executes properly
    if (inputData.event_type === 'ad_click' && node.id.startsWith('cond-start-')) {
      return { success: true, output: inputData };
    }

    // Pre-resolve tag names if any condition uses has_tag/not_has_tag
    const allConditions = Array.isArray(conditions) ? conditions : (condition ? [condition] : []);
    const needsTagResolution = allConditions.some(c => c.operator === 'has_tag' || c.operator === 'not_has_tag');
    if (needsTagResolution && !inputData._resolvedTagNames) {
      await this.resolveTagNamesForContact(inputData);
    }

    if (Array.isArray(conditions) && conditions.length > 0) {
      try {
        let matchedHandle = null;
        let matchedConditionId = null;

        for (const cond of conditions) {
          const { id, field, operator, value, sourceHandle } = cond;
          const condObj = { field, operator, value };
          const result = this.evaluateCondition(condObj, inputData);
          if (result) {
            matchedHandle = sourceHandle || id || null;
            matchedConditionId = id || null;
            break;
          }
        }

        const output = {
          ...inputData,
          conditionMatched: !!matchedHandle,
          matchedConditionId
        };

        if (matchedHandle) {
          output.__nextHandle = matchedHandle;
        } else if (no_match_handle) {
          output.__nextHandle = no_match_handle;
        }

        return { success: true, output };
      } catch (error) {
        return { success: false, output: {}, error: error.message };
      }
    }

    if (!condition) {
      return { success: true, output: inputData };
    }

    try {
      const result = this.evaluateCondition(condition, inputData);
      return { success: result, output: { ...inputData, conditionResult: result } };
    } catch (error) {
      return { success: false, output: {}, error: error.message };
    }
  }


  evaluateCondition(condition, data) {
    let { field, operator, value } = condition;

    if (!field && (operator || value !== undefined)) {
      field = 'message';
    }

    if (!field || !operator || value === undefined) {
      return false;
    }

    const fieldValue = this.getNestedValue(data, field);

    const strField = String(fieldValue ?? '').toLowerCase();
    const strValue = String(value ?? '').toLowerCase();

    switch (operator) {
      case 'equals':
        if (Array.isArray(value)) {
          return value.some(v => String(v).toLowerCase() === String(fieldValue).toLowerCase());
        }
        return String(fieldValue).toLowerCase() === String(value).toLowerCase();
      case 'not_equals':
        if (Array.isArray(value)) {
          return !value.some(v => String(v).toLowerCase() === String(fieldValue).toLowerCase());
        }
        return String(fieldValue).toLowerCase() !== String(value).toLowerCase();
      case 'contains':
        return strField.includes(strValue);
      case 'not_contains':
        return !strField.includes(strValue);
      case 'starts_with':
        return strField.startsWith(strValue);
      case 'ends_with':
        return strField.endsWith(strValue);
      case 'greater_than':
        return Number(fieldValue) > Number(value);
      case 'less_than':
        return Number(fieldValue) < Number(value);
      case 'greater_than_or_equal':
        return Number(fieldValue) >= Number(value);
      case 'less_than_or_equal':
        return Number(fieldValue) <= Number(value);
      case 'is_empty':
        return !fieldValue || fieldValue === '';
      case 'is_not_empty':
        return !!fieldValue && fieldValue !== '';
      case 'contains_any':
        if (!Array.isArray(value)) {
          return false;
        }
        return value.some(v => strField.includes(String(v).toLowerCase()));
      case 'has_tag': {
        // Check if contact has a specific tag by name
        const tagNames = data._resolvedTagNames;
        if (tagNames) {
          return tagNames.some(t => t.toLowerCase() === strValue);
        }
        return false;
      }
      case 'not_has_tag': {
        const tagNamesNot = data._resolvedTagNames;
        if (tagNamesNot) {
          return !tagNamesNot.some(t => t.toLowerCase() === strValue);
        }
        return true;
      }
      default:
        return true;
    }
  }


  getNestedValue(obj, path) {
    if (!obj || !path) return undefined;

    const directValue = path.split('.').reduce((current, key) => current?.[key], obj);
    if (directValue !== undefined) {
      return directValue;
    }

    if (path === 'contact_name') {
      return obj.contact?.name || obj.senderNumber || 'Customer';
    }
    if (path === 'phone_number' || path === 'sender_number') {
      return obj.senderNumber || obj.contact?.phone_number;
    }

    if (typeof obj.message === 'string' && path.startsWith('message.')) {
      const messageSubPath = path.slice('message.'.length);
      if (
        messageSubPath === 'messageContext.text.body' ||
        messageSubPath === 'text.body' ||
        messageSubPath === 'body'
      ) {
        return obj.message;
      }
    }

    if (obj.messagePayload) {
      const payloadValue = path.split('.').reduce((current, key) => current?.[key], { ...obj, message: obj.messagePayload });
      if (payloadValue !== undefined) {
        return payloadValue;
      }
    }

    if (obj.contact && obj.contact.custom_fields) {
      if (obj.contact.custom_fields[path] !== undefined) {
        return obj.contact.custom_fields[path];
      }

      const customValue = path.split('.').reduce((current, key) => current?.[key], obj.contact.custom_fields);
      if (customValue !== undefined) {
        return customValue;
      }
    }

    return undefined;
  }


  normalizeMessagePayload(message) {
    if (message && typeof message === 'object') {
      return message;
    }

    const textBody = message == null ? '' : String(message);
    return {
      messageContext: {
        text: {
          body: textBody
        }
      }
    };
  }


  async executeActionNode(node, inputData) {
    const { action_type, parameters } = node.parameters || {};

    switch (action_type) {
      case 'log':
        console.log('Automation log:', parameters?.message || 'Action executed', inputData);
        break;
      case 'set_variable':
        const { variable_name, variable_value } = parameters || {};
        if (variable_name) {
          inputData[variable_name] = variable_value;
        }
        break;
      default:
        break;
    }

    return { success: true, output: inputData };
  }


  async executeDelayNode(node, inputData, flow = null, executionLog = []) {
    const { delay_ms, delay_value, delay_unit } = node.parameters || { delay_ms: 1000 };

    // Calculate delay in milliseconds
    let totalDelayMs = delay_ms || 1000;
    if (delay_value && delay_unit) {
      switch (delay_unit) {
        case 'seconds': totalDelayMs = delay_value * 1000; break;
        case 'minutes': totalDelayMs = delay_value * 60 * 1000; break;
        case 'hours': totalDelayMs = delay_value * 60 * 60 * 1000; break;
        case 'days': totalDelayMs = delay_value * 24 * 60 * 60 * 1000; break;
        default: totalDelayMs = delay_value * 1000; break;
      }
    }

    // Short delays (< 5 minutes): use in-memory setTimeout
    const PERSISTENT_DELAY_THRESHOLD = 5 * 60 * 1000; // 5 minutes
    if (totalDelayMs < PERSISTENT_DELAY_THRESHOLD) {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ success: true, output: inputData });
        }, totalDelayMs);
      });
    }

    // Long delays (>= 5 minutes): use BullMQ persistent scheduling
    if (!flow) {
      console.warn('[AutomationEngine] No flow context for persistent delay, falling back to setTimeout');
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ success: true, output: inputData });
        }, Math.min(totalDelayMs, 300000)); // Cap at 5 min for fallback
      });
    }

    // Find the next node after this delay
    const nextNodes = this.getConnectedNodes(flow, node.id);
    const nextNodeId = nextNodes.length > 0 ? nextNodes[0].id : null;

    const executionId = this.findExecutionIdByLog(executionLog);
    if (!executionId) {
      console.error('[AutomationEngine] Could not find execution ID for persistent delay');
      return { success: false, error: 'Could not find active execution for persistent delay' };
    }

    try {
      const resumeAt = new Date(Date.now() + totalDelayMs);
      const userId = inputData.userId || inputData.user_id;

      const job = await scheduleDelayedResume({
        executionId: executionId.toString(),
        flowId: flow._id.toString(),
        nextNodeId,
        userId: userId?.toString(),
        delayMs: totalDelayMs
      });

      // Update execution to 'waiting' state with scheduled resume info
      await AutomationExecution.findByIdAndUpdate(executionId, {
        status: 'waiting',
        next_node_id: nextNodeId,
        waiting_for_node_id: node.id,
        contact_identifier: inputData.senderNumber,
        input_data: inputData,
        scheduled_resume_at: resumeAt,
        delay_job_id: job.id
      });

      const delayHours = Math.round(totalDelayMs / 3600000);
      console.log(`[AutomationEngine] Persistent delay scheduled: ${delayHours}h. Execution ${executionId} waiting until ${resumeAt.toISOString()}`);

      return { success: true, status: 'waiting', output: inputData };
    } catch (error) {
      console.error('[AutomationEngine] Failed to schedule persistent delay:', error.message);
      // Fallback to in-memory delay (capped at 5 min)
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ success: true, output: inputData });
        }, Math.min(totalDelayMs, 300000));
      });
    }
  }


  async executeFilterNode(node, inputData) {
    const { filter_condition } = node.parameters || {};

    if (!filter_condition) {
      return { success: true, output: inputData };
    }

    const shouldPass = this.evaluateCondition(filter_condition, inputData);
    return { success: shouldPass, output: shouldPass ? inputData : {} };
  }


  async executeTransformNode(node, inputData) {
    const { transform_type, mapping } = node.parameters || {};

    let output = { ...inputData };

    if (transform_type === 'field_mapping' && mapping) {
      for (const [targetField, sourceField] of Object.entries(mapping)) {
        output[targetField] = this.getNestedValue(inputData, sourceField);
      }
    }

    return { success: true, output };
  }


  async executeWebhookNode(node, inputData) {
    const { url, method, headers, body } = node.parameters || {};

    if (!url) {
      return { success: false, output: inputData, error: 'Webhook URL is required' };
    }

    try {

      const processedBody = this.processTemplateString(JSON.stringify(body || {}), inputData);
      const processedUrl = this.processTemplateString(url, inputData);
      const processedHeaders = this.processHeaders(headers || {}, inputData);

      const response = await fetch(processedUrl, {
        method: method || 'POST',
        headers: processedHeaders,
        body: processedBody
      });

      const responseText = await response.text();
      const responseJson = this.isJsonString(responseText) ? JSON.parse(responseText) : responseText;

      return {
        success: response.ok,
        output: { ...inputData, webhook_response: responseJson, webhook_status: response.status }
      };
    } catch (error) {
      return { success: false, output: inputData, error: error.message };
    }
  }


  processTemplateString(template, data) {
    if (typeof template !== 'string') {
      return template;
    }


    let result = template.replace(/\{\{\{([^{}]+)\}\}\}/g, (match, path) => {
      const value = this.getNestedValue(data, path.trim());
      return value !== undefined ? value : match;
    });

    result = result.replace(/\{\{([^{}]+)\}\}/g, (match, path) => {
      const value = this.getNestedValue(data, path.trim());
      return value !== undefined ? value : match;
    });

    return result;
  }


  processHeaders(headers, data) {
    const processedHeaders = {};
    for (const [key, value] of Object.entries(headers)) {
      processedHeaders[key] = this.processTemplateString(value, data);
    }
    return processedHeaders;
  }


  isJsonString(str) {
    try {
      JSON.parse(str);
      return true;
    } catch (e) {
      return false;
    }
  }


  async executeAIResponseNode(node, inputData) {
    const { ai_model, prompt_template, api_key } = node.parameters || {};

    if (!ai_model || !prompt_template) {
      return { success: false, output: inputData, error: 'AI model and prompt are required' };
    }

    try {
      const processedPrompt = this.processTemplateString(prompt_template, inputData);

      const aiResponse = `AI response for: ${processedPrompt.substring(0, 50)}...`;

      return {
        success: true,
        output: { ...inputData, ai_response: aiResponse }
      };
    } catch (error) {
      return { success: false, output: inputData, error: error.message };
    }
  }


  async executeSendMessageNode(node, inputData) {
    const {
      recipient,
      message_template,
      media_url,
      buttons,
      interactive_type,
      button_params,
      list_params,
      provider_type,
      messageType,
      location_params
    } = node.parameters || {};

    if (!recipient) {
      return { success: false, output: inputData, error: 'Recipient is required' };
    }

    try {
      const userId = inputData.userId || inputData.user_id;
      if (!userId) {
        console.error('No userId found in inputData:', inputData);
        return { success: false, output: inputData, error: 'User ID is required to send message' };
      }

      const processedRecipient = this.processTemplateString(recipient, inputData);

      const messageParams = {
        recipientNumber: processedRecipient,
        providerType: provider_type || PROVIDER_TYPES.BUSINESS_API
      };

      if (messageType === 'location' && location_params) {
        messageParams.messageType = 'location';
        messageParams.locationParams = {
          latitude: location_params.latitude,
          longitude: location_params.longitude,
          name: location_params.name || this.processTemplateString(location_params.name || '', inputData),
          address: location_params.address || this.processTemplateString(location_params.address || '', inputData)
        };
      } else {
        if (message_template) {
          const processedMessage = this.processTemplateString(message_template, inputData);
          messageParams.messageText = processedMessage;
        }
      }
      console.log("media_url" , media_url)
      if (media_url) {
        messageParams.mediaUrl = media_url;
        messageParams.file = {
          originalname: 'media',
          mimetype: this.getMimeTypeFromUrl(media_url),
          buffer: null,
          url: media_url
        };
      }

      if (interactive_type) {
        messageParams.messageType = 'interactive';
        messageParams.interactiveType = interactive_type;

        if (interactive_type === 'button' && button_params) {
          messageParams.buttonParams = button_params.map(btn => ({
            title: this.processTemplateString(btn.title, inputData),
            id: this.processTemplateString(btn.id, inputData)
          }));
        } else if (interactive_type === 'list' && list_params) {
          messageParams.listParams = {
            header: this.processTemplateString(list_params.header || '', inputData),
            body: this.processTemplateString(list_params.body || message_template || '', inputData),
            footer: this.processTemplateString(list_params.footer || '', inputData),
            buttonTitle: this.processTemplateString(list_params.buttonTitle || 'Select', inputData),
            sectionTitle: this.processTemplateString(list_params.sectionTitle || 'Options', inputData),
            items: (list_params.items || []).map(item => ({
              title: this.processTemplateString(item.title, inputData),
              description: this.processTemplateString(item.description || '', inputData),
              id: this.processTemplateString(item.id || item.title, inputData)
            }))
          };
        }
      } else if (buttons && Array.isArray(buttons) && buttons.length > 0 && buttons.length <= 3) {
        messageParams.buttons = buttons;
        messageParams.messageType = 'interactive';
        messageParams.interactiveType = 'button';
        messageParams.buttonParams = buttons.map(btn => ({
          id: btn.id,
          title: btn.text
        }));
      } else {
        if (messageParams.file) {
          const mime = messageParams.file.mimetype;
          if (mime.startsWith('image')) messageParams.messageType = 'image';
          else if (mime.startsWith('video')) messageParams.messageType = 'video';
          else if (mime.startsWith('audio')) messageParams.messageType = 'audio';
          else messageParams.messageType = 'document';
        } else if (!messageParams.messageType) {
          messageParams.messageType = 'text';
        }
      }


      if (inputData.whatsappPhoneNumberId) {
        const whatsappPhoneNumber = await WhatsappPhoneNumber.findById(inputData.whatsappPhoneNumberId)
          .populate('waba_id')
          .lean();

        if (whatsappPhoneNumber && whatsappPhoneNumber.waba_id) {
          messageParams.whatsappPhoneNumber = whatsappPhoneNumber;
        }
      } else if (inputData.whatsappConnectionId) {
        messageParams.connectionId = inputData.whatsappConnectionId;
      }

      const result = await unifiedWhatsAppService.sendMessage(userId, messageParams);

      return {
        success: true,
        output: {
          ...inputData,
          message_sent: true,
          sent_to: processedRecipient,
          provider: result.provider,
          message_id: result.messageId
        }
      };
    } catch (error) {
      return { success: false, output: inputData, error: error.message };
    }
  }


  async executeSendTemplateNode(node, inputData) {
    const {
      template_id,
      template_name,
      recipient,
      language_code,
      body_variables,
      header_media_url,
      carousel_cards_data,
      carousel_products,
      coupon_code,
      offer_expiration_minutes,
      product_retailer_id,
      url_button_value,
      provider_type
    } = node.parameters || {};

    if (!recipient) {
      return { success: false, output: inputData, error: 'Recipient is required for send_template node' };
    }

    const processedRecipient = this.processTemplateString(recipient, inputData);

    if (!template_id && !template_name) {
      return { success: false, output: inputData, error: 'template_id or template_name is required' };
    }

    const userId = inputData.userId || inputData.user_id;
    if (!userId) {
      return { success: false, output: inputData, error: 'userId is required to send template' };
    }

    try {
      let templateQuery;
      if (template_id) {
        templateQuery = {
          _id: template_id,
          $or: [{ user_id: userId }, { is_admin_template: true }, { user_id: null }, { user_id: { $exists: false } }]
        };
      } else {
        templateQuery = {
          template_name: template_name.toLowerCase(),
          $or: [{ user_id: userId }, { is_admin_template: true }, { user_id: null }, { user_id: { $exists: false } }]
        };
      }

      console.log(`[send_template] Looking up template:`, JSON.stringify(templateQuery));
      const template = await Template.findOne(templateQuery).lean();

      if (!template) {
        console.error(`[send_template] Template NOT found. Query:`, JSON.stringify(templateQuery));
        return {
          success: false,
          output: inputData,
          error: `Template not found: ${template_id || template_name}`
        };
      }

      console.log(`[send_template] Found template: "${template.template_name}" (type: ${template.template_type}, status: ${template.status})`);


      if (template.status !== 'approved') {
        return {
          success: false,
          output: inputData,
          error: `Template "${template.template_name}" is not approved (status: ${template.status})`
        };
      }

      const resolvedBodyVars = {};
      if (body_variables && typeof body_variables === 'object') {
        for (const [key, val] of Object.entries(body_variables)) {
          resolvedBodyVars[key] = this.processTemplateString(String(val ?? ''), inputData);
        }
      }

      const resolvedHeaderMediaUrl = header_media_url
        ? this.processTemplateString(header_media_url, inputData)
        : null;

      let resolvedCarouselCardsData = null;
      if (Array.isArray(carousel_cards_data) && carousel_cards_data.length > 0) {
        resolvedCarouselCardsData = carousel_cards_data.map(card => ({
          ...card,
          header: card.header
            ? {
                ...card.header,
                link: card.header.link
                  ? this.processTemplateString(card.header.link, inputData)
                  : undefined
              }
            : undefined,
          buttons: Array.isArray(card.buttons)
            ? card.buttons.map(btn => ({
                ...btn,
                url_value: btn.url_value
                  ? this.processTemplateString(btn.url_value, inputData)
                  : undefined,
                payload: btn.payload
                  ? this.processTemplateString(btn.payload, inputData)
                  : undefined
              }))
            : []
        }));
      }

      let resolvedCarouselProducts = null;
      if (Array.isArray(carousel_products) && carousel_products.length > 0) {
        resolvedCarouselProducts = carousel_products.map(p => ({
          product_retailer_id: this.processTemplateString(p.product_retailer_id, inputData),
          catalog_id: this.processTemplateString(p.catalog_id, inputData)
        }));
      }

      const messageParams = {
        recipientNumber: processedRecipient,
        messageType: 'template',
        templateName: template.template_name,
        languageCode: language_code || template.language || 'en_US',
        templateObj: template,
        templateVariables: resolvedBodyVars,
        providerType: provider_type || PROVIDER_TYPES.BUSINESS_API
      };

      if (resolvedHeaderMediaUrl) {
        messageParams.mediaUrl = resolvedHeaderMediaUrl;
      }

      if (resolvedCarouselCardsData) {
        messageParams.carouselCardsData = resolvedCarouselCardsData;
      }

      if (resolvedCarouselProducts) {
        messageParams.carouselProducts = resolvedCarouselProducts;
      }

      if (coupon_code) {
        messageParams.couponCode = this.processTemplateString(coupon_code, inputData);
      }

      if (offer_expiration_minutes !== undefined) {
        messageParams.offerExpirationMinutes = Number(offer_expiration_minutes);
      }

      if (product_retailer_id) {
        messageParams.productRetailerId = this.processTemplateString(product_retailer_id, inputData);
      }

      if (url_button_value) {
        if (!messageParams.templateVariables) messageParams.templateVariables = {};
        messageParams.templateVariables.url = this.processTemplateString(url_button_value, inputData);
      }

      if (inputData.whatsappPhoneNumberId) {
        const whatsappPhoneNumber = await WhatsappPhoneNumber.findById(inputData.whatsappPhoneNumberId)
          .populate('waba_id')
          .lean();
        if (whatsappPhoneNumber && whatsappPhoneNumber.waba_id) {
          messageParams.whatsappPhoneNumber = whatsappPhoneNumber;
        }
      } else if (inputData.whatsappConnectionId) {
        messageParams.connectionId = inputData.whatsappConnectionId;
      }

      const result = await unifiedWhatsAppService.sendMessage(userId, messageParams);

      return {
        success: true,
        output: {
          ...inputData,
          template_sent: true,
          template_name: template.template_name,
          template_type: template.template_type,
          sent_to: processedRecipient,
          provider: result?.provider,
          message_id: result?.messageId
        }
      };
    } catch (error) {
      console.error('Error in executeSendTemplateNode:', error);
      return { success: false, output: inputData, error: error.message };
    }
  }


  getMimeTypeFromUrl(url) {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('.jpg') || lowerUrl.includes('.jpeg')) return 'image/jpeg';
    if (lowerUrl.includes('.png')) return 'image/png';
    if (lowerUrl.includes('.mp4')) return 'video/mp4';
    if (lowerUrl.includes('.mp3')) return 'audio/mp3';
    if (lowerUrl.includes('.pdf')) return 'application/pdf';
    return 'application/octet-stream';
  }

  async executeAddTagNode(node, inputData) {
    const { tag_name } = node.parameters || {};

    if (!tag_name) {
      return { success: false, output: inputData, error: 'Tag name is required' };
    }


    return {
      success: true,
      output: { ...inputData, tag_added: tag_name }
    };
  }


  async executeUpdateContactNode(node, inputData) {
    const { updates } = node.parameters || {};

    const userId = inputData.userId || inputData.user_id;
    const contactId = inputData.contactId || inputData.contact?._id;

    if (!userId) {
      return { success: false, output: inputData, error: 'User ID is required to update contact' };
    }
    if (!contactId) {
      return { success: false, output: inputData, error: 'contactId is required to update contact' };
    }

    const resolvedUpdates = {};
    for (const [key, value] of Object.entries(updates || {})) {
      if (typeof value === 'string') {
        resolvedUpdates[key] = this.processTemplateString(value, inputData);
      } else {
        resolvedUpdates[key] = value;
      }
    }

    try {
      await Contact.updateOne(
        { _id: contactId, created_by: userId, deleted_at: null },
        { $set: resolvedUpdates }
      );

      const updatedContact = await Contact.findOne({
        _id: contactId,
        created_by: userId,
        deleted_at: null
      }).lean();

      return {
        success: true,
        output: {
          ...inputData,
          contact: updatedContact,
          contactId: updatedContact?._id?.toString() || contactId,
          contact_updated: resolvedUpdates
        }
      };
    } catch (err) {
      return { success: false, output: inputData, error: err.message };
    }
  }


  async executeResponseSaverNode(node, inputData) {
    const { mappings } = node.parameters || {};

    if (!Array.isArray(mappings) || mappings.length === 0) {
      return { success: true, output: inputData };
    }

    const userId = inputData.userId || inputData.user_id;
    const contactId = inputData.contactId || inputData.contact?._id;

    if (!userId) {
      return { success: false, output: inputData, error: 'User ID is required to save responses' };
    }
    if (!contactId) {
      return { success: false, output: inputData, error: 'contactId is required to save responses' };
    }

    const customFieldUpdates = {};
    const variableOutputs = {};

    for (const mapping of mappings) {
      if (!mapping) continue;
      const { source_path, variable_name, custom_field_key } = mapping;
      if (!source_path) continue;

      const value = this.getNestedValue(inputData, source_path);

      if (variable_name) {
        variableOutputs[variable_name] = value;
      }

      if (custom_field_key) {
        customFieldUpdates[`custom_fields.${custom_field_key}`] = value;
      }
    }

    try {
      if (Object.keys(customFieldUpdates).length > 0) {
        await Contact.updateOne(
          { _id: contactId, created_by: userId, deleted_at: null },
          { $set: customFieldUpdates }
        );
      }

      const updatedContact = await Contact.findOne({
        _id: contactId,
        created_by: userId,
        deleted_at: null
      }).lean();

      return {
        success: true,
        output: {
          ...inputData,
          ...variableOutputs,
          contact: updatedContact || inputData.contact,
          contactId: updatedContact?._id?.toString() || contactId,
          response_saved: Object.keys(customFieldUpdates)
        }
      };
    } catch (err) {
      return { success: false, output: inputData, error: err.message };
    }
  }


  async executeApiNode(node, inputData) {
    const { url, method, headers, body, response_mapping } = node.parameters || {};

    if (!url) {
      return { success: false, output: inputData, error: 'API URL is required' };
    }

    try {
      const processedUrl = this.processTemplateString(url, inputData);
      const processedHeaders = this.processHeaders(headers || {}, inputData);
      const processedBody = body ? this.processTemplateString(JSON.stringify(body), inputData) : null;

      const response = await fetch(processedUrl, {
        method: method || 'GET',
        headers: processedHeaders,
        body: processedBody && method !== 'GET' ? processedBody : undefined
      });

      const responseText = await response.text();
      const apiResponse = this.isJsonString(responseText) ? JSON.parse(responseText) : responseText;

      const userId = inputData.userId || inputData.user_id;
      const contactId = inputData.contactId || inputData.contact?._id;

      const variableOutputs = {};
      const customFieldUpdates = {};

      if (Array.isArray(response_mapping)) {
        for (const mapping of response_mapping) {
          if (!mapping) continue;
          const { response_path, variable_name, custom_field_key } = mapping;
          if (!response_path) continue;

          const value = this.getNestedValue(apiResponse, response_path);

          if (variable_name) {
            variableOutputs[variable_name] = value;
          }

          if (custom_field_key) {
            customFieldUpdates[`custom_fields.${custom_field_key}`] = value;
          }
        }
      }

      let updatedContact = inputData.contact;
      if (userId && contactId && Object.keys(customFieldUpdates).length > 0) {
        await Contact.updateOne(
          { _id: contactId, created_by: userId, deleted_at: null },
          { $set: customFieldUpdates }
        );

        updatedContact = await Contact.findOne({
          _id: contactId,
          created_by: userId,
          deleted_at: null
        }).lean();
      }

      return {
        success: response.ok,
        output: {
          ...inputData,
          ...variableOutputs,
          contact: updatedContact,
          contactId: updatedContact?._id?.toString() || contactId,
          api_status: response.status,
          api_response: apiResponse
        }
      };
    } catch (error) {
      return { success: false, output: inputData, error: error.message };
    }
  }


  async executeCustomNode(node, inputData) {
    const { custom_logic, parameters } = node.parameters || {};

    console.log('Executing custom node:', custom_logic);

    if (custom_logic === 'update_order_status') {
      const userId = inputData.userId || inputData.user_id;
      const orderId = this.processTemplateString(parameters?.order_id || '', inputData);
      const status = parameters?.status;

      if (!userId) {
        return { success: false, output: inputData, error: 'User ID is required to update order status' };
      }
      if (!orderId) {
        return { success: false, output: inputData, error: 'order_id is required' };
      }
      if (!status) {
        return { success: false, output: inputData, error: 'status is required' };
      }

      const updated = await EcommerceOrder.findOneAndUpdate(
        { _id: orderId, user_id: userId, deleted_at: null },
        { $set: { status } },
        { returnDocument: 'after' }
      ).lean();

      return {
        success: !!updated,
        output: { ...inputData, order: updated, order_status_updated: status },
        ...(updated ? {} : { error: 'Order not found' })
      };
    }

    return {
      success: true,
      output: { ...inputData, custom_executed: true }
    };
  }


  async executeUpdateLeadScoreNode(node, inputData) {
    const { score_action = 'increment', score_value = 0, auto_tag = true } = node.parameters || {};
    const contactId = inputData.contactId || inputData.contact?._id;
    const userId = inputData.userId || inputData.user_id;

    if (!contactId) {
      return { success: false, output: inputData, error: 'contactId is required for lead scoring' };
    }
    if (!userId) {
      return { success: false, output: inputData, error: 'userId is required for lead scoring' };
    }

    try {
      let updateOp;
      if (score_action === 'set') {
        updateOp = { $set: { 'custom_fields.lead_score': score_value } };
      } else {
        // increment (default)
        updateOp = { $inc: { 'custom_fields.lead_score': score_value } };
      }

      await Contact.updateOne(
        { _id: contactId, created_by: userId, deleted_at: null },
        updateOp
      );

      // Fetch updated contact to get new score
      const updatedContact = await Contact.findOne({
        _id: contactId,
        created_by: userId,
        deleted_at: null
      }).lean();

      const newScore = updatedContact?.custom_fields?.get?.('lead_score')
        || updatedContact?.custom_fields?.lead_score
        || 0;

      console.log(`[update_lead_score] Contact ${contactId}: score ${score_action === 'set' ? '=' : '+'}${score_value} → total ${newScore}`);

      // Auto-assign dynamic lead tags based on score thresholds
      if (auto_tag) {
        let tagName;
        if (newScore >= 50) {
          tagName = 'HOT_LEAD';
        } else if (newScore >= 20) {
          tagName = 'WARM_LEAD';
        } else {
          tagName = 'COLD_LEAD';
        }

        // Remove old lead tier tags, add new one
        const leadTierTags = ['HOT_LEAD', 'WARM_LEAD', 'COLD_LEAD'];
        for (const oldTag of leadTierTags) {
          if (oldTag !== tagName) {
            const existingTag = await Tag.findOne({ label: oldTag, created_by: userId, deleted_at: null });
            if (existingTag) {
              await Contact.findByIdAndUpdate(contactId, { $pull: { tags: existingTag._id } });
            }
          }
        }

        // Add the correct tier tag
        await this.executeAddTagNode(
          { parameters: { tag_name: tagName } },
          { ...inputData, contactId, userId }
        );

        console.log(`[update_lead_score] Auto-tagged contact ${contactId} as ${tagName} (score: ${newScore})`);
      }

      return {
        success: true,
        output: {
          ...inputData,
          contact: updatedContact,
          lead_score: newScore,
          lead_score_action: score_action,
          lead_score_change: score_value
        }
      };
    } catch (error) {
      console.error('[update_lead_score] Error:', error);
      return { success: false, output: inputData, error: error.message };
    }
  }


  /**
   * Resume an automation execution after a persistent delay.
   * Called by the automation-scheduler-queue worker.
   */
  async resumeFromDelay(executionId, flowId, nextNodeId, userId) {
    console.log(`[AutomationEngine] Resuming from delay: execution=${executionId}, flow=${flowId}, nextNode=${nextNodeId}`);

    try {
      const execution = await AutomationExecution.findById(executionId);
      if (!execution) {
        console.error(`[AutomationEngine] Execution ${executionId} not found`);
        return;
      }

      // Skip if execution was already completed/cancelled (e.g., user started trial)
      if (['success', 'failed', 'cancelled'].includes(execution.status)) {
        console.log(`[AutomationEngine] Execution ${executionId} already ${execution.status}. Skipping delay resume.`);
        return;
      }

      const flow = await AutomationFlow.findById(flowId).populate('user_id');
      if (!flow || !flow.is_active || flow.deleted_at) {
        console.log(`[AutomationEngine] Flow ${flowId} is inactive or deleted. Skipping delay resume.`);
        await AutomationExecution.findByIdAndUpdate(executionId, {
          status: 'cancelled',
          completed_at: new Date()
        });
        return;
      }

      const inputData = execution.input_data || {};

      // Pre-resolve contact tags for has_tag conditions
      if (inputData.contactId) {
        try {
          const contact = await Contact.findById(inputData.contactId).populate('tags', 'label').lean();
          if (contact) {
            inputData.contact = contact;
            inputData._resolvedTagNames = (contact.tags || []).map(t => t.label || t);
            inputData.lead_score = this.getContactLeadScore(contact);
          }
        } catch (e) {
          console.warn('[AutomationEngine] Could not refresh contact data:', e.message);
        }
      }

      // Update execution status
      await AutomationExecution.findByIdAndUpdate(executionId, {
        status: 'running',
        scheduled_resume_at: null,
        delay_job_id: null
      });

      if (!nextNodeId) {
        console.log('[AutomationEngine] No next node after delay. Completing execution.');
        await AutomationExecution.findByIdAndUpdate(executionId, {
          status: 'success',
          completed_at: new Date()
        });
        return;
      }

      const nextNode = flow.nodes.find(n => n.id === nextNodeId);
      if (!nextNode) {
        console.error(`[AutomationEngine] Next node ${nextNodeId} not found in flow`);
        await AutomationExecution.findByIdAndUpdate(executionId, {
          status: 'failed',
          error: `Node ${nextNodeId} not found`,
          completed_at: new Date()
        });
        return;
      }

      const executionLog = execution.execution_log || [];
      const execUuid = uuidv4();
      this.runningExecutions.set(execUuid, execution._id);

      const startTime = Date.now();
      const nodeResult = await this.executeNode(nextNode, flow, inputData, executionLog);

      if (nodeResult.status === 'waiting') {
        this.runningExecutions.delete(execUuid);
        return;
      }

      if (nodeResult.success || flow.settings?.error_handling === 'continue') {
        const updatedData = { ...inputData, ...nodeResult.output };
        const connResult = await this.processConnectedNodes(flow, nextNode, updatedData, executionLog, inputData);
        if (connResult && connResult.status === 'waiting') {
          this.runningExecutions.delete(execUuid);
          return;
        }
      }

      const resultStatus = nodeResult.success ? 'success' : 'failed';
      await AutomationExecution.findByIdAndUpdate(executionId, {
        status: resultStatus,
        output_data: inputData,
        execution_time: Date.now() - startTime,
        completed_at: new Date(),
        execution_log: executionLog
      });

      await this.updateFlowStatistics(flow._id, nodeResult.success);
      this.runningExecutions.delete(execUuid);

      console.log(`[AutomationEngine] Delay resume completed for execution ${executionId}`);
    } catch (error) {
      console.error(`[AutomationEngine] Error resuming from delay:`, error);
      await AutomationExecution.findByIdAndUpdate(executionId, {
        status: 'failed',
        error: error.message,
        completed_at: new Date()
      });
    }
  }


  /**
   * Resume an execution because a wait_for_reply TIMED OUT (no reply arrived).
   * Fires the SAME next node as a reply would, but with __reply_timed_out=true
   * so the following Logic Control takes the no-reply branch.
   *
   * Guarded so it is a no-op if a reply already advanced the execution:
   * only proceeds when the execution is still `waiting` on this exact wait node.
   */
  async resumeFromReplyTimeout(executionId, flowId, nextNodeId, waitNodeId, userId) {
    console.log(`[AutomationEngine] Reply timeout fired: execution=${executionId}, waitNode=${waitNodeId}, nextNode=${nextNodeId}`);

    try {
      const execution = await AutomationExecution.findById(executionId);
      if (!execution) {
        console.error(`[AutomationEngine] Execution ${executionId} not found for reply timeout`);
        return;
      }

      // Race guard: if the reply already arrived, the execution is no longer
      // waiting on this node (status changed or waiting on a different node).
      if (execution.status !== 'waiting' || String(execution.waiting_for_node_id) !== String(waitNodeId)) {
        console.log(`[AutomationEngine] Reply timeout skipped — execution ${executionId} is ${execution.status} on node ${execution.waiting_for_node_id} (expected waiting on ${waitNodeId}). Reply likely already handled.`);
        return;
      }

      const flow = await AutomationFlow.findById(flowId).populate('user_id');
      if (!flow || !flow.is_active || flow.deleted_at) {
        console.log(`[AutomationEngine] Flow ${flowId} inactive/deleted. Cancelling execution on reply timeout.`);
        await AutomationExecution.findByIdAndUpdate(executionId, {
          status: 'cancelled',
          completed_at: new Date()
        });
        return;
      }

      const inputData = execution.input_data || {};
      inputData.__reply_timed_out = true;

      // Refresh contact tags + lead score for downstream conditions.
      if (inputData.contactId) {
        try {
          const contact = await Contact.findById(inputData.contactId).populate('tags', 'label').lean();
          if (contact) {
            inputData.contact = contact;
            inputData._resolvedTagNames = (contact.tags || []).map(t => t.label || t);
            inputData.lead_score = this.getContactLeadScore(contact);
          }
        } catch (e) {
          console.warn('[AutomationEngine] Could not refresh contact data on reply timeout:', e.message);
        }
      }

      await AutomationExecution.findByIdAndUpdate(executionId, {
        status: 'running',
        scheduled_resume_at: null,
        reply_timeout_job_id: null,
        contact_identifier: null
      });

      if (!nextNodeId) {
        console.log('[AutomationEngine] No next node after reply timeout. Completing execution.');
        await AutomationExecution.findByIdAndUpdate(executionId, {
          status: 'success',
          completed_at: new Date()
        });
        return;
      }

      const nextNode = flow.nodes.find(n => n.id === nextNodeId);
      if (!nextNode) {
        console.error(`[AutomationEngine] Next node ${nextNodeId} not found for reply timeout`);
        await AutomationExecution.findByIdAndUpdate(executionId, {
          status: 'failed',
          error: `Node ${nextNodeId} not found`,
          completed_at: new Date()
        });
        return;
      }

      const executionLog = execution.execution_log || [];
      const execUuid = uuidv4();
      this.runningExecutions.set(execUuid, execution._id);

      const startTime = Date.now();
      const nodeResult = await this.executeNode(nextNode, flow, inputData, executionLog);

      if (nodeResult.status === 'waiting') {
        this.runningExecutions.delete(execUuid);
        return;
      }

      if (nodeResult.success || flow.settings?.error_handling === 'continue') {
        const updatedData = { ...inputData, ...nodeResult.output };
        const connResult = await this.processConnectedNodes(flow, nextNode, updatedData, executionLog, inputData);
        if (connResult && connResult.status === 'waiting') {
          this.runningExecutions.delete(execUuid);
          return;
        }
      }

      await AutomationExecution.findByIdAndUpdate(executionId, {
        status: nodeResult.success ? 'success' : 'failed',
        output_data: inputData,
        execution_time: Date.now() - startTime,
        completed_at: new Date(),
        execution_log: executionLog
      });

      await this.updateFlowStatistics(flow._id, nodeResult.success);
      this.runningExecutions.delete(execUuid);

      console.log(`[AutomationEngine] Reply timeout resume completed for execution ${executionId}`);
    } catch (error) {
      console.error(`[AutomationEngine] Error resuming from reply timeout:`, error);
      await AutomationExecution.findByIdAndUpdate(executionId, {
        status: 'failed',
        error: error.message,
        completed_at: new Date()
      });
    }
  }


  /**
   * Pre-resolve tag names for a contact before evaluating conditions.
   * This allows has_tag/not_has_tag operators to work.
   */
  async resolveTagNamesForContact(inputData) {
    if (inputData._resolvedTagNames) return inputData;

    const contactId = inputData.contactId || inputData.contact?._id;
    if (!contactId) return inputData;

    try {
      const contact = await Contact.findById(contactId).populate('tags', 'label').lean();
      if (contact) {
        inputData._resolvedTagNames = (contact.tags || []).map(t => t.label || t);
        inputData.contact = contact;
        inputData.lead_score = this.getContactLeadScore(contact);
      }
    } catch (e) {
      console.warn('[AutomationEngine] Could not resolve tag names:', e.message);
    }

    return inputData;
  }


  async updateFlowStatistics(flowId, success) {
    try {
      const update = {
        $inc: {
          'statistics.total_executions': 1,
          'statistics.average_execution_time': 0
        }
      };

      if (success) {
        update.$inc['statistics.successful_executions'] = 1;
      } else {
        update.$inc['statistics.failed_executions'] = 1;
      }

      update.$set = { 'statistics.last_execution': new Date() };

      await AutomationFlow.findByIdAndUpdate(flowId, update);
    } catch (error) {
      console.error('Error updating flow statistics:', error);
    }
  }


  async executeWaitForReplyNode(node, flow, inputData, executionLog) {
    const { variable_name = 'last_user_message' } = node.parameters || {};

    const nextNodes = this.getConnectedNodes(flow, node.id);
    const nextNodeId = nextNodes.length > 0 ? nextNodes[0].id : null;

    const executionId = this.findExecutionIdByLog(executionLog);
    if (!executionId) {
      return { success: false, error: 'Could not find active execution' };
    }

    // A fresh wait starts with no timeout flag; clear any leftover flag so the
    // following Logic Control sees the correct state for THIS wait.
    const cleanedInput = { ...inputData, __reply_timed_out: false };

    // Optional reply timeout. When configured, we schedule a persistent BullMQ
    // job that resumes the SAME next node with __reply_timed_out=true — but only
    // if no reply arrived first (verified in resumeFromReplyTimeout).
    const timeoutMs = this.resolveTimeoutMs(node.parameters);
    let replyTimeoutJobId = null;
    let scheduledResumeAt = null;

    if (timeoutMs && timeoutMs > 0) {
      try {
        const userId = inputData.userId || inputData.user_id;
        const job = await scheduleReplyTimeout({
          executionId: executionId.toString(),
          flowId: flow._id.toString(),
          waitNodeId: node.id,
          nextNodeId,
          userId: userId?.toString(),
          delayMs: timeoutMs
        });
        replyTimeoutJobId = job?.id || null;
        scheduledResumeAt = new Date(Date.now() + timeoutMs);
      } catch (err) {
        console.warn(`[AutomationEngine] Could not schedule reply timeout for ${node.id}:`, err.message);
      }
    }

    await AutomationExecution.findByIdAndUpdate(executionId, {
      status: 'waiting',
      next_node_id: nextNodeId,
      waiting_for_node_id: node.id,
      contact_identifier: inputData.senderNumber,
      input_data: cleanedInput,
      reply_timeout_job_id: replyTimeoutJobId,
      scheduled_resume_at: scheduledResumeAt
    });

    console.log(`Execution ${executionId} is now waiting for reply from ${inputData.senderNumber}. Next node: ${nextNodeId}${timeoutMs ? ` (timeout ${Math.round(timeoutMs / 3600000)}h)` : ''}`);

    return { success: true, status: 'waiting', output: cleanedInput };
  }


  /**
   * Resolve a timeout duration (ms) from a node's parameters. Supports
   * timeout_ms, or timeout_value + timeout_unit (seconds/minutes/hours/days).
   */
  resolveTimeoutMs(parameters = {}) {
    const { timeout_ms, timeout_value, timeout_unit } = parameters || {};
    if (timeout_ms && Number(timeout_ms) > 0) {
      return Number(timeout_ms);
    }
    if (timeout_value && timeout_unit) {
      const v = Number(timeout_value);
      switch (timeout_unit) {
        case 'seconds': return v * 1000;
        case 'minutes': return v * 60 * 1000;
        case 'hours': return v * 60 * 60 * 1000;
        case 'days': return v * 24 * 60 * 60 * 1000;
        default: return v * 1000;
      }
    }
    return 0;
  }


  /**
   * Read a contact's numeric lead_score, tolerating both Map (hydrated doc)
   * and plain-object (lean) custom_fields shapes.
   */
  getContactLeadScore(contact) {
    if (!contact || !contact.custom_fields) return 0;
    const cf = contact.custom_fields;
    let raw;
    if (typeof cf.get === 'function') {
      raw = cf.get('lead_score');
    } else {
      raw = cf.lead_score;
    }
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }


  findExecutionIdByLog(executionLog) {
    for (const [key, value] of this.runningExecutions.entries()) {
      return value;
    }
    return null;
  }


  async resumeExecution(flow, execution, eventData, messagePayload) {
    console.log(`Resuming automation execution ${execution._id}`);

    const waitingNode = flow.nodes.find(n => n.id === execution.waiting_for_node_id);
    const variableName = waitingNode?.parameters?.variable_name || 'last_user_message';

    const messageText = typeof eventData.message === 'string' ? eventData.message : eventData.message?.text?.body || '';
    const currentData = {
      ...execution.input_data,
      [variableName]: messageText,
      last_message: messageText,
      messagePayload,
      // Reply arrived → this is NOT a timeout. The following Logic Control uses
      // this to distinguish reply vs no-reply branches.
      __reply_timed_out: false
    };

    // Refresh contact tags + lead score so downstream conditions are accurate.
    delete currentData._resolvedTagNames;
    await this.resolveTagNamesForContact(currentData);

    // A reply arrived — cancel any pending timeout job so the no-reply branch
    // does not also fire (prevents duplicate/racing execution).
    if (execution.reply_timeout_job_id) {
      await cancelDelayedResume(execution.reply_timeout_job_id);
    }

    await AutomationExecution.findByIdAndUpdate(execution._id, {
      status: 'running',
      contact_identifier: null,
      reply_timeout_job_id: null,
      scheduled_resume_at: null
    });

    const nextNodeId = execution.next_node_id;
    if (!nextNodeId) {
      console.log('No next node to execute after resume');
      await AutomationExecution.findByIdAndUpdate(execution._id, {
        status: 'success',
        completed_at: new Date()
      });
      return { success: true };
    }

    const nextNode = flow.nodes.find(n => n.id === nextNodeId);
    if (!nextNode) {
      throw new Error(`Next node ${nextNodeId} not found in flow`);
    }

    const executionLog = execution.execution_log || [];
    const executionId = uuidv4();
    this.runningExecutions.set(executionId, execution._id);

    const startTime = Date.now();
    const nodeResult = await this.executeNode(nextNode, flow, currentData, executionLog);

    if (nodeResult.status === 'waiting') {
       this.runningExecutions.delete(executionId);
       return { success: true };
    }

    if (nodeResult.success || flow.settings?.error_handling === 'continue') {
      const updatedData = {
        ...currentData,
        ...nodeResult.output
      };


      const connResult = await this.processConnectedNodes(flow, nextNode, updatedData, executionLog, currentData);
      if (connResult && connResult.status === 'waiting') {
        this.runningExecutions.delete(executionId);
        return { success: true };
      }
    }

    const resultStatus = nodeResult.success ? 'success' : 'failed';
    const executionTime = Date.now() - startTime;

    await AutomationExecution.findByIdAndUpdate(execution._id, {
      status: resultStatus,
      output_data: currentData,
      execution_time: executionTime,
      completed_at: new Date(),
      execution_log: executionLog
    });

    await this.updateFlowStatistics(flow._id, nodeResult.success);
    this.runningExecutions.delete(executionId);

    return { success: true };
  }


  async triggerEvent(eventType, eventData) {
    console.log('Triggering event:', eventType, 'with data:', eventData);
    const handler = this.eventListeners.get(eventType);
    if (handler) {
      console.log('Found handler for event:', eventType);
      await handler(eventData);
    } else {
      console.log('No handler found for event:', eventType, 'Available handlers:', Array.from(this.eventListeners.keys()));
    }
  }


  getRunningExecutions() {
    return Array.from(this.runningExecutions.values());
  }


  async cancelExecution(executionId) {
    if (this.runningExecutions.has(executionId)) {
      await AutomationExecution.findByIdAndUpdate(
        this.runningExecutions.get(executionId),
        { status: 'cancelled', completed_at: new Date() }
      );
      this.runningExecutions.delete(executionId);
    }
  }

  async executeAddTagNode(node, inputData, flow = null) {
    const { tag_id, tag_name } = node.parameters || {};
    const contactId = inputData.contactId;

    if (!contactId) {
      return { success: false, output: inputData, error: 'contactId is required' };
    }

    try {
      const userId = inputData.userId || inputData.user_id;
      let tag;
      if (tag_id) {
        tag = await Tag.findById(tag_id);
      } else if (tag_name) {
        tag = await Tag.findOne({ label: tag_name, created_by: userId, deleted_at: null });

        if (!tag) {
          tag = await Tag.create({
            label: tag_name,
            created_by: userId,
            color: '#007bff'
          });
        }
      }

      if (!tag) {
        return { success: false, output: inputData, error: 'Tag not found and could not be created' };
      }

      // Determine whether the tag is NEWLY assigned. Side-trigger lead scoring
      // must fire only once per tag, so we score only on a genuinely new tag.
      // This also prevents duplicate scoring if a node is re-entered.
      const contactBefore = await Contact.findById(contactId).select('tags').lean();
      const alreadyHadTag = (contactBefore?.tags || []).some(t => String(t) === String(tag._id));

      // Idempotent add (no duplicate tags).
      await Contact.findByIdAndUpdate(contactId, {
        $addToSet: { tags: tag._id }
      });

      await ContactTag.findOneAndUpdate(
        { contact_id: contactId, tag_id: tag._id },
        { deleted_at: null },
        { upsert: true }
      );

      let output = { ...inputData, last_tag_added: tag.label };

      // Side-trigger lead scoring: if this flow defines points for this tag and
      // the tag was newly assigned, increment the contact's lead_score. Runs
      // "in parallel" off the tag assignment, not as an inline graph node.
      const rules = flow?.lead_scoring_rules || null;
      const points = rules ? (rules[tag.label] ?? rules.get?.(tag.label)) : undefined;
      if (!alreadyHadTag && points && Number(points) !== 0) {
        try {
          await Contact.updateOne(
            { _id: contactId, created_by: userId, deleted_at: null },
            { $inc: { 'custom_fields.lead_score': Number(points) } }
          );
          const refreshed = await Contact.findById(contactId).lean();
          const newScore = this.getContactLeadScore(refreshed);
          output.lead_score = newScore;
          output.contact = refreshed;
          console.log(`[add_tag] Lead scoring: +${points} for "${tag.label}" → total ${newScore} (contact ${contactId})`);
        } catch (scoreErr) {
          console.warn(`[add_tag] Lead scoring failed for "${tag.label}":`, scoreErr.message);
        }
      }

      console.log(`[add_tag] Added tag "${tag.label}" to contact ${contactId}${alreadyHadTag ? ' (already present)' : ''}`);
      return { success: true, output };
    } catch (error) {
      console.error(`[add_tag] Error:`, error);
      return { success: false, output: inputData, error: error.message };
    }
  }

  async executeSendCtaNode(node, inputData) {
    const { recipient, text, button_text, url } = node.parameters || {};
    const userId = inputData.userId || inputData.user_id;
    const whatsappPhoneNumberId = inputData.whatsappPhoneNumberId;

    if (!recipient || !text || !button_text || !url) {
      return { success: false, output: inputData, error: 'Missing required parameters for CTA button' };
    }

    const processedRecipient = this.processTemplateString(recipient, inputData);
    const processedText = this.processTemplateString(text, inputData);
    const processedUrl = this.processTemplateString(url, inputData);

    try {
      await unifiedWhatsAppService.sendMessage(userId, {
        recipientNumber: processedRecipient,
        whatsappPhoneNumberId,
        messageText: processedText,
        messageType: 'interactive',
        interactiveType: 'cta_url',
        buttonParams: {
          display_text: button_text,
          url: processedUrl
        }
      });

      return { success: true, output: inputData };
    } catch (error) {
      console.error(`[cta_button] Error:`, error);
      return { success: false, output: inputData, error: error.message };
    }
  }

  async executeAssignChatbotNode(node, inputData) {
    const { chatbot_id, duration_hours } = node.parameters || {};
    const senderNumber = inputData.senderNumber;
    const recipientNumber = inputData.recipientNumber;
    const whatsappPhoneNumberId = inputData.whatsappPhoneNumberId;
    const userId = inputData.userId || inputData.user_id;

    if (!chatbot_id) {
      return { success: false, output: inputData, error: 'chatbot_id is required' };
    }

    try {
      let expiresAt = null;
      if (duration_hours && duration_hours > 0) {
        expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + Number(duration_hours));
      }

      await ChatAssignment.findOneAndUpdate(
        {
          sender_number: senderNumber,
          receiver_number: recipientNumber,
          whatsapp_phone_number_id: whatsappPhoneNumberId
        },
        {
          chatbot_id,
          chatbot_expires_at: expiresAt,
          assigned_by: userId,
          status: 'assigned',
          is_solved: false
        },
        { upsert: true, returnDocument: 'after' }
      );

      console.log(`[assign_chatbot] Assigned chatbot ${chatbot_id} to ${senderNumber} (expires: ${expiresAt || 'never'})`);
      return { success: true, output: { ...inputData, chatbot_assigned_id: chatbot_id } };
    } catch (error) {
      console.error(`[assign_chatbot] Error:`, error);
      return { success: false, output: inputData, error: error.message };
    }
  }


  /**
   * Convert a 0-based column index to an A1 column letter (0->A, 26->AA).
   */
  columnIndexToLetter(index) {
    let letter = '';
    let n = index;
    while (n >= 0) {
      letter = String.fromCharCode((n % 26) + 65) + letter;
      n = Math.floor(n / 26) - 1;
    }
    return letter;
  }

  async executeSaveToGoogleSheetNode(node, inputData) {
    const {
      google_account_id,
      spreadsheet_id,
      sheet_name = 'Sheet1',
      column_mappings,
      // operation: 'append' (default) | 'upsert' | 'update'
      // - append: always add a new row
      // - upsert: update the row whose match_column == match_value, else append
      // - update: update the matching row only (no-op + warning if not found)
      operation = 'append',
      match_column,
      match_value,
      headers
    } = node.parameters || {};

    if (!google_account_id || !spreadsheet_id) {
      return { success: false, output: inputData, error: 'google_account_id and spreadsheet_id are required' };
    }

    try {
      const sheets = await getSheetsClient(google_account_id);

      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: spreadsheet_id });
      const sheetNames = spreadsheet.data.sheets.map(s => s.properties.title);
      const targetSheet = sheetNames.find(name => name.trim() === sheet_name.trim()) || sheetNames[0];
      console.log(`[google_sheet] Using sheet: "${targetSheet}" (Requested: "${sheet_name}") op=${operation}`);

      // Load current sheet contents (header row + data) so we can do
      // header-aligned writes and find rows for update/upsert.
      const existing = await sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheet_id,
        range: `'${targetSheet}'`
      });
      const grid = existing.data.values || [];
      let headerRow = grid.length > 0 ? grid[0] : [];

      const mappings = Array.isArray(column_mappings) ? column_mappings : [];
      const isHeaderBased = mappings.some(m => m && typeof m.column === 'string' && !/^[A-Z]+$/.test(m.column.trim()));

      // Ensure a header row exists when using header-based mappings.
      if ((isHeaderBased || Array.isArray(headers)) && headerRow.length === 0) {
        const desiredHeaders = Array.isArray(headers) && headers.length > 0
          ? headers
          : mappings.map(m => m.column);
        await sheets.spreadsheets.values.update({
          spreadsheetId: spreadsheet_id,
          range: `'${targetSheet}'!A1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [desiredHeaders] }
        });
        headerRow = desiredHeaders;
        grid[0] = desiredHeaders;
      }

      // Resolve mappings into { colIndex -> value }.
      const resolvedByIndex = {};
      const resolvedValuesOrdered = [];
      for (const m of mappings) {
        if (!m) continue;
        const value = this.processTemplateString(m.value || '', inputData);
        resolvedValuesOrdered.push(value);
        if (typeof m.column === 'string') {
          let idx;
          if (/^[A-Z]+$/.test(m.column.trim())) {
            // Explicit A1 column letter.
            idx = m.column.trim().split('').reduce((acc, ch) => acc * 26 + (ch.charCodeAt(0) - 64), 0) - 1;
          } else {
            idx = headerRow.findIndex(h => String(h).trim() === m.column.trim());
            if (idx === -1) {
              // Header not present yet — append it.
              idx = headerRow.length;
              headerRow[idx] = m.column;
              await sheets.spreadsheets.values.update({
                spreadsheetId: spreadsheet_id,
                range: `'${targetSheet}'!A1`,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [headerRow] }
              });
            }
          }
          resolvedByIndex[idx] = value;
        }
      }

      // Locate an existing row for update/upsert.
      let matchRowNumber = -1; // 1-based sheet row number
      if (operation === 'update' || operation === 'upsert') {
        if (!match_column || match_value === undefined) {
          return { success: false, output: inputData, error: `operation "${operation}" requires match_column and match_value` };
        }
        const resolvedMatch = this.processTemplateString(String(match_value), inputData);
        let matchColIdx;
        if (/^[A-Z]+$/.test(String(match_column).trim())) {
          matchColIdx = String(match_column).trim().split('').reduce((acc, ch) => acc * 26 + (ch.charCodeAt(0) - 64), 0) - 1;
        } else {
          matchColIdx = headerRow.findIndex(h => String(h).trim() === String(match_column).trim());
        }
        if (matchColIdx >= 0) {
          // Search from the bottom so we update the most recent matching row.
          for (let r = grid.length - 1; r >= 1; r--) {
            const cell = (grid[r] || [])[matchColIdx];
            if (cell !== undefined && String(cell).trim() === String(resolvedMatch).trim()) {
              matchRowNumber = r + 1; // convert 0-based grid index to 1-based row
              break;
            }
          }
        }
      }

      if ((operation === 'update' || operation === 'upsert') && matchRowNumber > 0) {
        // Merge updates into the existing row and write it back.
        const rowIdx = matchRowNumber - 1;
        const merged = [...(grid[rowIdx] || [])];
        const width = Math.max(merged.length, headerRow.length, ...Object.keys(resolvedByIndex).map(k => Number(k) + 1));
        for (let i = 0; i < width; i++) if (merged[i] === undefined) merged[i] = '';
        for (const [idx, val] of Object.entries(resolvedByIndex)) merged[Number(idx)] = val;

        const endCol = this.columnIndexToLetter(merged.length - 1);
        await sheets.spreadsheets.values.update({
          spreadsheetId: spreadsheet_id,
          range: `'${targetSheet}'!A${matchRowNumber}:${endCol}${matchRowNumber}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [merged] }
        });
        return { success: true, output: { ...inputData, sheet_used: targetSheet, sheet_operation: 'update', sheet_row: matchRowNumber, row_written: merged } };
      }

      if (operation === 'update' && matchRowNumber <= 0) {
        console.warn(`[google_sheet] update: no row matched ${match_column}=${match_value}. Nothing updated.`);
        return { success: true, output: { ...inputData, sheet_used: targetSheet, sheet_operation: 'update', sheet_row: null } };
      }

      // append (or upsert with no existing match): build a header-aligned row.
      let rowValues;
      if (Object.keys(resolvedByIndex).length > 0) {
        const width = Math.max(headerRow.length, ...Object.keys(resolvedByIndex).map(k => Number(k) + 1));
        rowValues = new Array(width).fill('');
        for (const [idx, val] of Object.entries(resolvedByIndex)) rowValues[Number(idx)] = val;
      } else if (resolvedValuesOrdered.length > 0) {
        rowValues = resolvedValuesOrdered;
      } else {
        rowValues = [inputData.contact?.name || '', inputData.senderNumber || '', new Date().toLocaleString()];
      }

      await sheets.spreadsheets.values.append({
        spreadsheetId: spreadsheet_id,
        range: `'${targetSheet}'`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [rowValues] }
      });

      return { success: true, output: { ...inputData, sheet_used: targetSheet, sheet_operation: operation === 'upsert' ? 'upsert-insert' : 'append', row_written: rowValues } };
    } catch (error) {
      console.error('Error saving to Google Sheet in automation:', error);
      await handleGoogleApiError(error, google_account_id);
      return { success: false, output: inputData, error: error.message };
    }
  }


  async executeCreateCalendarEventNode(node, inputData) {
    const { google_account_id, calendar_id = 'primary', summary, description, start_time, end_time } = node.parameters || {};

    console.log(`[google_calendar] Starting event creation for calendar: ${calendar_id}`);

    if (!google_account_id) {
      console.error('[google_calendar] Error: google_account_id is missing');
      return { success: false, output: inputData, error: 'google_account_id is required' };
    }

    try {
      const calendar = await getCalendarClient(google_account_id);

      const resolvedSummary = this.processTemplateString(summary || 'WhatsApp Scheduled Event', inputData);
      const resolvedDescription = this.processTemplateString(description || '', inputData);
      const resolvedStart = this.processTemplateString(start_time || new Date().toISOString(), inputData);

      console.log(`[google_calendar] Resolved Summary: "${resolvedSummary}"`);
      console.log(`[google_calendar] Resolved StartTime: "${resolvedStart}"`);

      let resolvedEnd = this.processTemplateString(end_time || '', inputData);
      if (!resolvedEnd) {
        const start = new Date(resolvedStart);
        start.setMinutes(start.getMinutes() + 30);
        resolvedEnd = start.toISOString();
      }

      const response = await calendar.events.insert({
        calendarId: calendar_id,
        requestBody: {
          summary: resolvedSummary,
          description: resolvedDescription,
          start: { dateTime: resolvedStart },
          end: { dateTime: resolvedEnd }
        }
      });

      console.log(`[google_calendar] Event created successfully: ${response.data.id}`);
      return { success: true, output: { event: response.data } };
    } catch (error) {
      console.error('[google_calendar] Error creating calendar event:', error.message);
      await handleGoogleApiError(error, google_account_id);
      return { success: false, output: inputData, error: error.message };
    }
  }

  async executeAppointmentFlowNode(node, flow, inputData, executionLog) {
    const { appointment_config_id } = node.parameters || {};

    if (!appointment_config_id) {
      return { success: false, output: inputData, error: 'appointment_config_id is required' };
    }

    try {
      await appointmentService.startConversationalFlow({
        userId: flow.user_id,
        contactId: inputData.contactId,
        configId: appointment_config_id,
        whatsappPhoneNumberId: inputData.whatsappPhoneNumberId,
        inputData: inputData
      });

      return { status: 'waiting', success: true, output: inputData };
    } catch (error) {
      console.error('Error executing appointment flow node:', error);
      return { success: false, output: inputData, error: error.message };
    }
  }
}

const automationEngine = new AutomationEngine();

export default automationEngine;
