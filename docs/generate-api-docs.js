/**
 * ChatWave Backend — Production-Quality API Documentation Generator
 * Generates OpenAPI 3.0 (Swagger) + Postman Collection v2.1
 * with meaningful names, descriptions, headers, and realistic dummy data.
 * 
 * Usage: node generate-api-docs.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROUTES_DIR = path.join(__dirname, 'routes');

// ═══════════════════════════════════════════════
// ROUTE PREFIX MAP (from app.js)
// ═══════════════════════════════════════════════
const ROUTE_PREFIX_MAP = {
  'auth.routes': '/api/auth',
  'faq.routes': '/api/faq',
  'contact-inquiries.routes': '/api/inquiry',
  'testimonial.routes': '/api/testimonial',
  'unified-whatsapp.routes': '/api/whatsapp',
  'chat.routes': '/api/chat',
  'plan.routes': '/api/plan',
  'subscription.routes': '/api/subscription',
  'whatsapp-connection.routes': '/api/whatsapp-connection',
  'ai-assistance.routes': '/api/ai',
  'agent.routes': '/api/agent',
  'agent-task.routes': '/api/agent-task',
  'ai.routes': '/api/ai',
  'automation.routes': '/api/automation',
  'template.routes': '/api/template',
  'ecommerce-webhook.routes': '/api/ecommerce-webhook',
  'ecommerce-catalog.routes': '/api/ecommerce-catalog',
  'ecommerce-order.routes': '/api/ecommerce-order',
  'contact.routes': '/api/contacts',
  'custom-field.routes': '/api/custom-fields',
  'tag.routes': '/api/tags',
  'setting.routes': '/api/settings',
  'user-setting.routes': '/api/user-settings',
  'user.routes': '/api/users',
  'attachment.routes': '/api/attachment',
  'campaign.routes': '/api/campaigns',
  'message-status.routes': '/api/message-status',
  'campaign-stats.routes': '/api/campaign-stats',
  'dashboard.routes': '/api/dashboard',
  'admin-dashboard.routes': '/api/admin-dashboard',
  'admin-template.routes': '/api/admin-template',
  'landing-page.routes': '/api/landing-page',
  'api-key.routes': '/api/api-keys',
  'widget.routes': '/api/widgets',
  'short-link.routes': '/api/short-links',
  'import-job.routes': '/api/import-jobs',
  'reply-material.routes': '/api/reply-materials',
  'working-hours.routes': '/api/working-hours',
  'workspace.routes': '/api/workspaces',
  'sequence.routes': '/api/sequences',
  'chatbot.routes': '/api/chatbots',
  'team.route': '/api/teams',
  'google.routes': '/api/google',
  'formBuilder.route': '/api/forms',
  'submission.route': '/api/submissions',
  'quick-reply.routes': '/api/quick-replies',
  'impersonation.routes': '/api/impersonation',
  'kanban-funnel.routes': '/api/kanban-funnels',
  'segment.routes': '/api/segments',
  'facebook.routes': '/api/facebook',
  'facebook-ad-campaign.routes': '/api/facebook-ads',
  'facebook-lead.routes': '/api/facebook-leads',
  'waba-configuration.routes': '/api/waba-configurations',
  'message-bot.routes': '/api/message-bots',
  'whatsapp-calling.routes': '/api/whatsapp/calling',
  'currency.routes': '/api/currencies',
  'language.routes': '/api/languages',
  'pages.routes': '/api/pages',
  'role.routes': '/api/roles',
  'tax.routes': '/api/taxes',
  'appointment.routes': '/api/appointments',
  'payment-gateway-config.routes': '/api/payment-gateways',
  'payment-webhook.routes': '/api/payments',
  'webhook.routes': '/api/webhook',
  'admin-template.routes': '/api/admin/templates',
};

// ═══════════════════════════════════════════════
// TAG INFO
// ═══════════════════════════════════════════════
const ROUTE_TO_TAG = {
  'auth.routes': 'Authentication',
  'faq.routes': 'FAQ Management',
  'contact-inquiries.routes': 'Contact Inquiries',
  'testimonial.routes': 'Testimonials',
  'unified-whatsapp.routes': 'WhatsApp Messaging',
  'chat.routes': 'Chat Management',
  'plan.routes': 'Subscription Plans',
  'subscription.routes': 'User Subscriptions',
  'whatsapp-connection.routes': 'WhatsApp Connections (Legacy)',
  'ai-assistance.routes': 'AI Assistance',
  'agent.routes': 'Agent Management',
  'agent-task.routes': 'Agent Tasks',
  'ai.routes': 'AI Model Configuration',
  'automation.routes': 'Workflow Automation',
  'template.routes': 'Message Templates',
  'ecommerce-webhook.routes': 'Ecommerce Webhooks',
  'ecommerce-catalog.routes': 'Product Catalogs',
  'ecommerce-order.routes': 'Order Management',
  'contact.routes': 'Contact Directory',
  'custom-field.routes': 'Custom Fields',
  'tag.routes': 'Contact Tags',
  'setting.routes': 'System Settings',
  'user-setting.routes': 'User Preferences',
  'user.routes': 'User Management',
  'attachment.routes': 'File Attachments',
  'campaign.routes': 'Broadcast Campaigns',
  'message-status.routes': 'Message Delivery Status',
  'campaign-stats.routes': 'Campaign Analytics',
  'dashboard.routes': 'Dashboard Analytics',
  'admin-dashboard.routes': 'Admin Dashboard',
  'admin-template.routes': 'Admin Template Library',
  'landing-page.routes': 'Landing Page Builder',
  'api-key.routes': 'Developer API Keys',
  'widget.routes': 'Chat Widgets',
  'short-link.routes': 'Short Links',
  'import-job.routes': 'Contact Import Jobs',
  'reply-material.routes': 'Reply Materials Library',
  'working-hours.routes': 'Business Working Hours',
  'workspace.routes': 'Workspace Management',
  'sequence.routes': 'Message Sequences',
  'chatbot.routes': 'Chatbot Configuration',
  'team.route': 'Team Management',
  'google.routes': 'Google Integration',
  'formBuilder.route': 'WhatsApp Form Builder',
  'submission.route': 'Form Submissions',
  'quick-reply.routes': 'Quick Replies',
  'impersonation.routes': 'Admin Impersonation',
  'kanban-funnel.routes': 'Kanban / Pipeline Funnels',
  'segment.routes': 'Contact Segments',
  'facebook.routes': 'Facebook Integration',
  'facebook-ad-campaign.routes': 'Facebook Ads',
  'facebook-lead.routes': 'Facebook Lead Forms',
  'waba-configuration.routes': 'WABA Configuration',
  'message-bot.routes': 'Automated Message Bots',
  'whatsapp-calling.routes': 'WhatsApp Business Calling',
  'currency.routes': 'Currency Management',
  'language.routes': 'Language & Translations',
  'pages.routes': 'CMS Pages',
  'role.routes': 'Roles & Permissions',
  'tax.routes': 'Tax Configuration',
  'appointment.routes': 'Appointment Scheduling',
  'payment-gateway-config.routes': 'Payment Gateway Setup',
  'payment-webhook.routes': 'Payment Webhooks',
  'webhook.routes': 'Webhooks',
};

const TAG_DESCRIPTIONS = {
  'Authentication': 'User registration, login, OTP verification, password reset, profile management, and session handling. Supports email/phone-based login with JWT tokens.',
  'FAQ Management': 'Create, read, update, and delete frequently asked questions for the landing page and help center.',
  'Contact Inquiries': 'Manage customer inquiries submitted through the contact form on the public landing page.',
  'Testimonials': 'Manage customer testimonials displayed on the landing page. Includes CRUD operations and status toggling.',
  'WhatsApp Messaging': 'Core WhatsApp messaging functionality — send messages, manage chats, view conversations, connect WhatsApp accounts via Cloud API or Baileys.',
  'Chat Management': 'Internal chat management — notes, assignments, bulk operations, and conversation metadata.',
  'Subscription Plans': 'Define and manage subscription plans with features, limits, pricing, and trial periods.',
  'User Subscriptions': 'Full subscription lifecycle — create, cancel, resume, change plans, process payments (Stripe/Razorpay/PayPal/Manual).',
  'WhatsApp Connections (Legacy)': 'Legacy WhatsApp connection management using direct API integration.',
  'AI Assistance': 'AI-powered text generation, grammar correction, tone adjustment, and message summarization.',
  'Agent Management': 'Manage agents (team members) — create, update, delete agents with role assignments.',
  'Agent Tasks': 'Task management system for agents — create, assign, track, and complete tasks.',
  'AI Model Configuration': 'Configure AI models (GPT, Claude, Gemini, etc.) — add API keys, set defaults, test connections.',
  'Workflow Automation': 'Visual workflow automation builder — create triggers, conditions, and actions for automated messaging.',
  'Message Templates': 'WhatsApp message template management — create, sync with Meta, submit for approval, and manage template library.',
  'Ecommerce Webhooks': 'Configure webhooks for ecommerce platform integrations (Shopify, WooCommerce, etc.).',
  'Product Catalogs': 'Manage product catalogs synced with WhatsApp Commerce — products, categories, and inventory.',
  'Order Management': 'Track and manage ecommerce orders received through WhatsApp — status updates and analytics.',
  'Contact Directory': 'Complete contact management — CRUD, import/export, bulk operations, tagging, and custom fields.',
  'Custom Fields': 'Define custom data fields for contacts — text, number, date, dropdown, checkbox types.',
  'Contact Tags': 'Tag system for organizing and segmenting contacts with color-coded labels.',
  'System Settings': 'Global application settings — branding, SMTP, WhatsApp config, feature toggles.',
  'User Preferences': 'Per-user settings — notification preferences, chat appearance, background images.',
  'User Management': 'Admin user management — create staff accounts, assign roles, reset passwords.',
  'File Attachments': 'Upload and manage file attachments — images, documents, audio, video for messages.',
  'Broadcast Campaigns': 'Create and schedule broadcast campaigns to send bulk WhatsApp messages to contact segments.',
  'Message Delivery Status': 'Track message delivery, read receipts, and failure status for sent messages.',
  'Campaign Analytics': 'Detailed campaign performance analytics — delivery rates, read rates, response rates.',
  'Dashboard Analytics': 'Main dashboard with key metrics — conversations, contacts, revenue, growth charts.',
  'Admin Dashboard': 'Super admin dashboard with platform-wide analytics — total users, revenue, subscriptions.',
  'Admin Template Library': 'Admin-managed template library — create pre-built templates for users to discover and use.',
  'Landing Page Builder': 'Configure the public landing page — hero section, features, pricing, testimonials, footer.',
  'Developer API Keys': 'Generate and manage API keys for programmatic access to the ChatWave API.',
  'Chat Widgets': 'Configure embeddable chat widgets for websites — appearance, behavior, and phone number assignment.',
  'Short Links': 'Create trackable short links for WhatsApp click-to-chat — analytics and redirection.',
  'Contact Import Jobs': 'Bulk import contacts from CSV/Excel files — track import progress and handle duplicates.',
  'Reply Materials Library': 'Manage reusable reply materials — images, documents, audio clips for quick message composition.',
  'Business Working Hours': 'Configure business working hours per WABA — auto-reply outside hours.',
  'Workspace Management': 'Multi-workspace support — create, switch, and manage separate business workspaces.',
  'Message Sequences': 'Automated message sequences — define multi-step follow-up campaigns with delays.',
  'Chatbot Configuration': 'Configure keyword-triggered chatbots with automated responses and conversation flows.',
  'Team Management': 'Create and manage teams/departments — assign agents, set team-level permissions.',
  'Google Integration': 'Google OAuth integration — Calendar sync, Google Sheets import/export.',
  'WhatsApp Form Builder': 'Build interactive WhatsApp forms using Meta Flows API — create, publish, and track responses.',
  'Form Submissions': 'View and manage form submission data — analytics, status tracking, and export.',
  'Quick Replies': 'Create and manage quick reply templates for fast message responses. Includes favorites.',
  'Admin Impersonation': 'Super admin feature to impersonate user accounts for support and debugging.',
  'Kanban / Pipeline Funnels': 'Visual Kanban boards for sales pipelines — stages, items, drag-and-drop management.',
  'Contact Segments': 'Create dynamic and static contact segments based on filters and conditions.',
  'Facebook Integration': 'Connect Facebook pages, manage WABA setup via Facebook Business Manager.',
  'Facebook Ads': 'Create and manage Click-to-WhatsApp ad campaigns — campaigns, ad sets, ads, and insights.',
  'Facebook Lead Forms': 'Connect Facebook lead generation forms to automatically capture leads into contacts.',
  'WABA Configuration': 'WhatsApp Business Account (WABA) level configuration — webhook URLs, business profile.',
  'Automated Message Bots': 'Configure automated message bots triggered by events, keywords, or schedules.',
  'WhatsApp Business Calling': 'WhatsApp Business Calling features — agent management, call routing, call logs, and recordings.',
  'Currency Management': 'Manage supported currencies — add, toggle active/default, conversion rates.',
  'Language & Translations': 'Multi-language support — manage languages, edit translation keys, toggle active languages.',
  'CMS Pages': 'Content Management System — create and manage custom pages (Privacy Policy, Terms, etc.).',
  'Roles & Permissions': 'Role-based access control — create roles, assign granular permissions.',
  'Tax Configuration': 'Configure tax rates for subscription billing — GST, VAT, sales tax.',
  'Appointment Scheduling': 'Appointment booking system — configure availability, manage bookings, send reminders.',
  'Payment Gateway Setup': 'Configure payment gateways (Stripe, Razorpay, PayPal) — API keys, webhooks, testing.',
  'Payment Webhooks': 'Receive and process payment event webhooks from Stripe, Razorpay, and PayPal.',
};

// ═══════════════════════════════════════════════
// HUMAN-READABLE NAME MAP: funcName → Display Name
// ═══════════════════════════════════════════════
const FUNC_NAME_MAP = {
  // Auth
  register: 'Register New Account',
  login: 'Login with Email/Phone',
  verifyOTP: 'Verify Login OTP',
  resendOTP: 'Resend Login OTP',
  resendSignUpOTP: 'Resend Sign-Up OTP',
  verifySignUpOTP: 'Verify Sign-Up OTP',
  forgotPassword: 'Forgot Password - Send Reset Email',
  resetPassword: 'Reset Password with OTP',
  resetPasswordViaToken: 'Reset Password via Email Token',
  logout: 'Logout Current Session',
  getProfile: 'Get My Profile',
  updateProfile: 'Update My Profile',
  getPublicRoles: 'Get Public Roles (No Auth)',
  getMyPermissions: 'Get My Permissions',
  changePassword: 'Change Password',
  deleteAccount: 'Delete My Account',

  // Users
  createUser: 'Create New User',
  getAllUsers: 'Get All Users',
  getUserById: 'Get User by ID',
  updateUser: 'Update User',
  deleteUsers: 'Bulk Delete Users',
  sendResetPasswordLink: 'Send Password Reset Link',

  // Contacts
  getAllContacts: 'Get All Contacts',
  createContact: 'Create New Contact',
  getContactById: 'Get Contact by ID',
  updateContact: 'Update Contact',
  deleteContacts: 'Bulk Delete Contacts',
  importContacts: 'Import Contacts (CSV/Excel)',
  exportContacts: 'Export Contacts',
  getContactAnalytics: 'Get Contact Analytics',
  getContactTimeline: 'Get Contact Activity Timeline',
  bulkTagContacts: 'Bulk Tag Contacts',
  bulkUntagContacts: 'Bulk Untag Contacts',
  mergeContacts: 'Merge Duplicate Contacts',

  // Tags
  createTag: 'Create New Tag',
  getAllTags: 'Get All Tags',
  getTagById: 'Get Tag by ID',
  updateTag: 'Update Tag',
  deleteTags: 'Bulk Delete Tags',

  // Custom Fields
  createCustomField: 'Create Custom Field',
  getAllCustomFields: 'Get All Custom Fields',
  getCustomFieldById: 'Get Custom Field by ID',
  updateCustomField: 'Update Custom Field',
  deleteCustomField: 'Delete Custom Field',
  getFieldTypes: 'Get Available Field Types',

  // Chat
  getChatMessages: 'Get Chat Messages',
  addChatNote: 'Add Note to Chat',
  getChatNotes: 'Get Chat Notes',
  deleteChatNote: 'Delete Chat Note',
  deleteChat: 'Delete Entire Chat',
  markChatAsRead: 'Mark Chat as Read',

  // WhatsApp
  sendMessage: 'Send WhatsApp Message',
  getMessages: 'Get Messages for Contact',
  getRecentChats: 'Get Recent Chat List',
  togglePinChat: 'Pin/Unpin Chat',
  assignChatToAgent: 'Assign Chat to Agent',
  getConnectionStatus: 'Get WhatsApp Connection Status',
  connectWhatsApp: 'Connect WhatsApp Account',
  getBaileysQRCode: 'Get Baileys QR Code',
  updateConnection: 'Update WhatsApp Connection',
  deleteConnections: 'Delete WhatsApp Connections',
  disconnectWhatsApp: 'Disconnect WhatsApp Account',
  getUserConnections: 'Get All WhatsApp Connections',
  getWabaList: 'Get WABA Account List',
  getMyPhoneNumbers: 'Get My Phone Numbers',
  setPrimaryPhoneNumber: 'Set Primary Phone Number',
  getWabaPhoneNumbers: 'Get WABA Phone Numbers',
  getEmbbededSignupConnection: 'Complete Embedded Signup',
  getContactProfile: 'Get WhatsApp Contact Profile',

  // Templates
  createTemplate: 'Create Message Template',
  getAllTemplates: 'Get All Templates',
  getTemplatesFromMeta: 'Fetch Templates from Meta',
  getTemplateById: 'Get Template by ID',
  syncTemplatesFromMeta: 'Sync Templates from Meta',
  syncTemplatesStatusFromMeta: 'Sync Template Statuses',
  suggestTemplate: 'AI Suggest Template Content',
  updateTemplate: 'Update Template',
  deleteTemplate: 'Delete Template',
  migrateTemplate: 'Migrate Template to New WABA',
  getAdminTemplatesForUsers: 'Get Admin Template Library',

  // Campaigns
  createCampaign: 'Create Broadcast Campaign',
  getAllCampaigns: 'Get All Campaigns',
  getCampaignById: 'Get Campaign by ID',
  updateCampaign: 'Update Campaign',
  deleteCampaign: 'Delete Campaign',
  sendCampaign: 'Send/Schedule Campaign',
  cancelCampaign: 'Cancel Running Campaign',

  // Automation
  createAutomationFlow: 'Create Automation Flow',
  getAutomationFlows: 'Get All Automation Flows',
  getAutomationFlow: 'Get Automation Flow by ID',
  updateAutomationFlow: 'Update Automation Flow',
  deleteAutomationFlow: 'Delete Automation Flow',
  toggleAutomationFlow: 'Toggle Automation On/Off',
  testAutomationFlow: 'Test Automation Flow',
  getAutomationExecutions: 'Get Automation Execution Logs',
  getAutomationExecution: 'Get Execution Details',
  getAutomationStatistics: 'Get Automation Statistics',
  getAvailableNodeTypes: 'Get Available Node Types',
  toggleAutomation: 'Toggle Automation On/Off',
  duplicateAutomation: 'Duplicate Automation',
  getAutomationLogs: 'Get Automation Execution Logs',
  testAutomation: 'Test Automation Flow',
  getAutomationStats: 'Get Automation Statistics',

  // Plans
  getActivePlans: 'Get Active Plans (Public)',
  getFeaturedPlans: 'Get Featured Plans',
  getPlanById: 'Get Plan by ID',
  getAllPlans: 'Get All Plans',
  createPlan: 'Create Subscription Plan',
  syncPlan: 'Sync Plan with Payment Gateway',
  updatePlan: 'Update Plan',
  updatePlanStatus: 'Toggle Plan Status',
  deletePlan: 'Delete Plans',

  // Subscriptions
  getMySubscription: 'Get My Subscription',
  getUsage: 'Get Usage Statistics',
  getCheckoutUrl: 'Get Checkout URL',
  createStripeSubscription: 'Create Stripe Subscription',
  createRazorpaySubscription: 'Create Razorpay Subscription',
  createPayPalSubscription: 'Create PayPal Subscription',
  createManualSubscription: 'Create Manual Subscription',
  getManagePortal: 'Get Billing Portal URL',
  cancelSubscription: 'Cancel Subscription',
  resumeSubscription: 'Resume Subscription',
  changePlan: 'Change Subscription Plan',
  getInvoice: 'Get Payment Invoice',
  getAllSubscriptions: 'Get All Subscriptions (Admin)',
  getSubscriptionStats: 'Get Subscription Statistics',
  getPaymentHistory: 'Get Payment History',
  getPendingManual: 'Get Pending Manual Payments',
  approveManual: 'Approve Manual Payment',
  rejectManual: 'Reject Manual Payment',
  assignSubscription: 'Assign Subscription to User',
  overrideLimits: 'Override User Plan Limits',
  resetLimits: 'Reset User Plan Limits',

  // Settings
  getSettings: 'Get System Settings',
  updateSettings: 'Update System Settings',
  testMailSettings: 'Test Email Configuration',

  // Dashboard
  getDashboardData: 'Get Dashboard Analytics',
  getDashboardStats: 'Get Dashboard Statistics',

  // Agents
  createAgent: 'Create New Agent',
  getAgents: 'Get All Agents',
  getAgentById: 'Get Agent by ID',
  updateAgent: 'Update Agent',
  deleteAgent: 'Delete Agents',
  toggleAgentStatus: 'Toggle Agent Status',
  getAgentProfile: 'Get Agent Profile',

  // Workspaces
  createWorkspace: 'Create New Workspace',
  getWorkspaces: 'Get All Workspaces',
  getWorkspaceById: 'Get Workspace by ID',
  updateWorkspace: 'Update Workspace',
  deleteWorkspace: 'Delete Workspace',
  getConnectedWorkspaces: 'Get Connected Workspaces',

  // FAQ
  createFaq: 'Create FAQ',
  getAllFaqs: 'Get All FAQs',
  getFaqById: 'Get FAQ by ID',
  updateFaq: 'Update FAQ',
  deleteFaq: 'Delete FAQs',

  // Roles
  createRole: 'Create New Role',
  getAllRoles: 'Get All Roles',
  getRoleById: 'Get Role by ID',
  updateRole: 'Update Role',
  deleteRole: 'Delete Roles',
  toggleRoleStatus: 'Toggle Role Status',
  getPermissions: 'Get All Permissions',

  // Teams
  createTeam: 'Create New Team',
  getAllTeams: 'Get All Teams',
  getTeamById: 'Get Team by ID',
  updateTeam: 'Update Team',
  deleteTeam: 'Delete Teams',
  toggleTeamStatus: 'Toggle Team Status',
  getTeamPermissions: 'Get Team Permissions',

  // Widgets
  createWidget: 'Create Chat Widget',
  updateWidget: 'Update Chat Widget',
  deleteWidget: 'Delete Chat Widget',
  bulkDeleteWidgets: 'Bulk Delete Widgets',
  getAllWidgets: 'Get All Widgets',
  getWidgetById: 'Get Widget by ID',
  getWidgetByPhoneNumber: 'Get Widget by Phone Number',

  // Short Links
  createShortLink: 'Create Short Link',
  getAllShortLinks: 'Get All Short Links',
  getShortLinkById: 'Get Short Link by ID',
  updateShortLink: 'Update Short Link',
  bulkDeleteShortLinks: 'Bulk Delete Short Links',
  redirectShortLink: 'Redirect Short Link',

  // Kanban
  createKanbanFunnel: 'Create Kanban Pipeline',
  getKanbanFunnels: 'Get All Pipelines',
  getKanbanFunnelById: 'Get Pipeline by ID',
  updateKanbanFunnel: 'Update Pipeline',
  deleteKanbanFunnel: 'Delete Pipeline',
  getAvailableData: 'Get Available Data for Pipeline',
  getKanbanItems: 'Get Pipeline Items',
  moveKanbanItem: 'Move Item Between Stages',
  updateKanbanItem: 'Update Pipeline Item',
  deleteKanbanItem: 'Delete Pipeline Item',
  getKanbanStages: 'Get Pipeline Stages',
  updateKanbanStages: 'Update Pipeline Stages',

  // Segments
  createSegment: 'Create Contact Segment',
  getSegments: 'Get All Segments',
  getSegmentById: 'Get Segment by ID',
  updateSegment: 'Update Segment',
  deleteSegment: 'Delete Segment',
  deleteSegments: 'Bulk Delete Segments',
  addContactsToSegment: 'Add Contacts to Segment',
  removeContactsFromSegment: 'Remove Contacts from Segment',
  getSegmentContacts: 'Get Contacts in Segment',

  // Impersonation
  startImpersonation: 'Start User Impersonation',
  stopImpersonation: 'Stop Impersonation',
  getImpersonationStatus: 'Check Impersonation Status',

  // Google
  connectGoogleAccount: 'Connect Google Account',
  getGoogleAccounts: 'Get Google Accounts',
  getGoogleAccountById: 'Get Google Account by ID',
  deleteGoogleAccount: 'Disconnect Google Account',
  getGoogleCalendars: 'Get Google Calendars',
  getCalendarEvents: 'Get Calendar Events',
  createCalendarEvent: 'Create Calendar Event',
  updateCalendarEvent: 'Update Calendar Event',
  deleteCalendarEvent: 'Delete Calendar Event',
  linkCalendar: 'Link Calendar to WABA',
  getGoogleSheets: 'Get Google Sheets',
  getSheetValues: 'Get Sheet Data',
  appendSheetValues: 'Append Data to Sheet',

  // Facebook
  connectFacebook: 'Connect Facebook Account',
  getFacebookPages: 'Get Facebook Pages',
  syncFacebookPages: 'Sync Facebook Pages',
  requestFacebookOTP: 'Request Facebook Page OTP',
  verifyFacebookOTP: 'Verify Facebook Page OTP',

  // Facebook Ads
  getAdAccounts: 'Get Ad Accounts',
  createFbAdCampaign: 'Create Ad Campaign',
  getFbAdCampaigns: 'Get All Ad Campaigns',
  getFbAdCampaignById: 'Get Ad Campaign by ID',
  updateFbAdCampaign: 'Update Ad Campaign',
  deleteFbAdCampaign: 'Delete Ad Campaign',
  updateFbAdCampaignStatus: 'Update Campaign Status',
  syncFbAdCampaignStatus: 'Sync Campaign Status',
  syncFacebookAdAccounts: 'Sync Ad Accounts',
  syncRemoteCampaigns: 'Sync Remote Campaigns',
  getFbAdInsights: 'Get Ad Insights/Analytics',
  getFbAdHierarchy: 'Get Ad Hierarchy Tree',
  createFbAdSet: 'Create Ad Set',
  updateFbAdSet: 'Update Ad Set',
  deleteFbAdSet: 'Delete Ad Set',
  getAdSetsByCampaign: 'Get Ad Sets by Campaign',
  getAdSetById: 'Get Ad Set by ID',
  createFbAd: 'Create Ad',
  updateFbAd: 'Update Ad',
  deleteFbAd: 'Delete Ad',
  getAdsByAdSet: 'Get Ads by Ad Set',
  getAdById: 'Get Ad by ID',
  updateFbAdBudget: 'Update Ad Budget',

  // Payment Webhooks
  handleStripeWebhook: 'Stripe Payment Webhook',
  handleRazorpayWebhook: 'Razorpay Payment Webhook',
  handlePayPalWebhook: 'PayPal Payment Webhook',
  handleWebhookVerification: 'WhatsApp Webhook Verification',
  handleIncomingMessage: 'WhatsApp Incoming Message Webhook',

  // Form Builder
  getAllForms: 'Get All WhatsApp Forms',
  createForm: 'Create WhatsApp Form',
  getFormById: 'Get Form by ID',
  updateForm: 'Update Form',
  deleteForm: 'Delete Form',
  publishForm: 'Publish/Unpublish Form',
  syncMetaFlow: 'Sync Form with Meta Flows',
  getFormTemplate: 'Get Form Template',
  syncFlowsStatusFromMeta: 'Sync Flow Statuses from Meta',
  migrateFlows: 'Migrate Flows to New WABA',
  getAllMetaFlows: 'Get All Meta Flows by WABA',

  // Appointments
  getAppointmentConfig: 'Get Appointment Configuration',
  createAppointmentConfig: 'Create Appointment Configuration',
  updateAppointmentConfig: 'Update Appointment Configuration',
  deleteAppointmentConfig: 'Delete Appointment Configuration',
  getAppointmentConfigById: 'Get Appointment Config by ID',
  getBookings: 'Get All Bookings',
  getBookingById: 'Get Booking by ID',
  updateBookingStatus: 'Update Booking Status',
  getAvailableSlots: 'Get Available Time Slots',
  bookAppointment: 'Book New Appointment',
  cancelBooking: 'Cancel Booking',
  getAppointmentStats: 'Get Appointment Statistics',
  rescheduleBooking: 'Reschedule Booking',
  bulkDeleteBookings: 'Bulk Delete Bookings',
  getAvailableConfigs: 'Get Available Appointment Configs',

  // Currencies
  createCurrency: 'Create New Currency',
  getAllCurrencies: 'Get All Currencies',
  getCurrencyById: 'Get Currency by ID',
  updateCurrency: 'Update Currency',
  deleteCurrency: 'Delete Currency',
  bulkDeleteCurrencies: 'Bulk Delete Currencies',
  toggleCurrencyStatus: 'Toggle Currency Active Status',
  toggleDefaultCurrency: 'Set Default Currency',

  // Languages
  createLanguage: 'Create New Language',
  getAllLanguages: 'Get All Languages',
  getLanguageById: 'Get Language by ID',
  updateLanguage: 'Update Language',
  deleteLanguage: 'Delete Languages',
  toggleLanguageStatus: 'Toggle Language Active Status',
  toggleDefaultLanguage: 'Set Default Language',
  getTranslations: 'Get Translations for Locale',
  updateTranslations: 'Update Translations for Locale',

  // Pages (CMS)
  createPage: 'Create CMS Page',
  getAllPages: 'Get All CMS Pages',
  getPageById: 'Get Page by ID',
  updatePage: 'Update CMS Page',
  deletePages: 'Delete CMS Pages',
  togglePageStatus: 'Toggle Page Active Status',

  // Chatbots
  createChatbot: 'Create New Chatbot',
  getChatbots: 'Get All Chatbots',
  getChatbotById: 'Get Chatbot by ID',
  updateChatbot: 'Update Chatbot',
  deleteChatbot: 'Delete Chatbot',
  bulkDeleteChatbots: 'Bulk Delete Chatbots',

  // Attachments
  uploadAttachment: 'Upload File Attachment',
  getAllAttachments: 'Get All Attachments',
  getAttachmentById: 'Get Attachment by ID',
  deleteAttachment: 'Delete Attachment',
  uploadMediaToWhatsApp: 'Upload Media to WhatsApp',
  getMediaFromWhatsApp: 'Get WhatsApp Media URL',

  // Message Bots
  createMessageBot: 'Create Message Bot',
  getMessageBots: 'Get All Message Bots',
  getMessageBotById: 'Get Message Bot by ID',
  updateMessageBot: 'Update Message Bot',
  deleteMessageBot: 'Delete Message Bot',
  bulkDeleteMessageBots: 'Bulk Delete Message Bots',

  // Landing Page
  getLandingPageConfig: 'Get Landing Page Configuration',
  updateLandingPageConfig: 'Update Landing Page Configuration',
  uploadLandingImage: 'Upload Landing Page Image',

  // Admin Templates
  createAdminTemplate: 'Create Admin Template',
  getAdminTemplates: 'Get All Admin Templates',
  getAdminTemplateById: 'Get Admin Template by ID',
  updateAdminTemplate: 'Update Admin Template',
  deleteAdminTemplate: 'Delete Admin Template',
  bulkDeleteAdminTemplates: 'Bulk Delete Admin Templates',

  // Admin Dashboard
  getAdminDashboardData: 'Get Admin Dashboard Data',
  getAdminDashboardStats: 'Get Admin Dashboard Statistics',

  // Ecommerce Catalogs
  syncCatalog: 'Sync WhatsApp Product Catalog',
  getUserCatalogs: 'Get User Catalogs',
  getUserProducts: 'Get User Products',
  getProductById: 'Get Product by ID',
  updateProductInCatalog: 'Update Product in Catalog',
  deleteProductFromCatalog: 'Delete Product from Catalog',
  getProductFunnels: 'Get Product Funnels',
  getProductKanbanStatus: 'Get Product Kanban Status',
  handleProductKanbanAction: 'Move Product in Kanban',

  // Ecommerce Orders
  getUserOrders: 'Get User Orders',
  getOrderById: 'Get Order by ID',
  getOrdersByMessageId: 'Get Orders by Message ID',
  getOrderStats: 'Get Order Statistics',
  updateOrderStatus: 'Update Order Status',
  upsertOrderStatusTemplate: 'Create/Update Order Status Template',
  getOrderStatusTemplates: 'Get Order Status Templates',
  bulkDeleteOrders: 'Bulk Delete Orders',

  // Ecommerce Webhooks
  createWebhook: 'Create Ecommerce Webhook',
  listWebhooks: 'List All Ecommerce Webhooks',
  getWebhook: 'Get Ecommerce Webhook by ID',
  updateWebhook: 'Update Ecommerce Webhook',
  deleteWebhook: 'Delete Ecommerce Webhook',
  toggleWebhook: 'Toggle Webhook Active/Inactive',
  triggerWebhook: 'Trigger Webhook Manually',
  getWebhookStats: 'Get Webhook Statistics',
  mapTemplate: 'Map Template to Webhook',

  // Facebook Leads
  getInstantForms: 'Get Facebook Instant Forms',
  connectLeadForm: 'Connect Lead Form',
  getConnectedForms: 'Get Connected Lead Forms',
  updateFormMapping: 'Update Form Field Mapping',
  disconnectForm: 'Disconnect Lead Form',
  getLeadsForForm: 'Get Leads for Form',
  subscribePageToApp: 'Subscribe Page to App Webhooks',
  verifyLeadgenWebhook: 'Verify Leadgen Webhook (GET)',
  handleLeadgenWebhook: 'Handle Leadgen Webhook (POST)',

  // Reply Materials
  createReplyMaterial: 'Upload Reply Material',
  getReplyMaterials: 'Get All Reply Materials',
  getReplyMaterialById: 'Get Reply Material by ID',
  updateReplyMaterial: 'Update Reply Material',
  deleteReplyMaterial: 'Delete Reply Material',
  bulkDeleteReplyMaterials: 'Bulk Delete Reply Materials',

  // Quick Replies
  createQuickReply: 'Create Quick Reply',
  getQuickReplies: 'Get All Quick Replies',
  getAdminQuickReplies: 'Get Admin Quick Replies',
  updateQuickReply: 'Update Quick Reply',
  deleteQuickReplies: 'Delete Quick Replies',
  toggleFavorite: 'Toggle Quick Reply Favorite',

  // Sequences
  createSequence: 'Create Message Sequence',
  getSequences: 'Get All Sequences',
  getSequenceById: 'Get Sequence by ID',
  updateSequence: 'Update Sequence',
  deleteSequence: 'Delete Sequence',
  createStep: 'Create Sequence Step',
  reorderSteps: 'Reorder Sequence Steps',
  updateStep: 'Update Sequence Step',
  deleteStep: 'Delete Sequence Step',

  // Message Status
  markDelivered: 'Mark Message as Delivered',
  markRead: 'Mark Message as Read',
  bulkMarkDelivered: 'Bulk Mark Messages Delivered',
  bulkMarkRead: 'Bulk Mark Messages Read',
  getUserMessageStatus: 'Get User Message Status',

  // Campaign Stats
  getCampaignStats: 'Get Campaign Statistics',
  getCampaignMessageStats: 'Get Campaign Message Stats',

  // Import Jobs
  getImportJobs: 'Get All Import Jobs',
  getImportJobById: 'Get Import Job by ID',
  bulkDeleteImportJobs: 'Bulk Delete Import Jobs',

  // API Keys
  createApiKey: 'Generate New API Key',
  getApiKeys: 'Get All API Keys',
  deleteApiKey: 'Revoke API Key',

  // Working Hours
  upsertWorkingHours: 'Set Working Hours',
  getWorkingHoursByWaba: 'Get Working Hours by WABA',
  deleteWorkingHours: 'Delete Working Hours',

  // WABA Configuration
  getWabaConfiguration: 'Get WABA Configuration',
  updateWabaConfiguration: 'Update WABA Configuration',

  // WhatsApp Connection (Legacy)
  createWhatsappConnection: 'Create WhatsApp Connection',
  getWhatsappConnection: 'Get WhatsApp Connection',
  updateWhatsappConnection: 'Update WhatsApp Connection',

  // WhatsApp Calling
  getCallSettings: 'Get Call Settings',
  updateCallSettings: 'Update Call Settings',
  getCallAgents: 'Get Call Agents',
  getCallAgentById: 'Get Call Agent by ID',
  createCallAgent: 'Create Call Agent',
  updateCallAgent: 'Update Call Agent',
  deleteCallAgent: 'Delete Call Agents',
  assignAgentToContact: 'Assign Agent to Contact',
  assignAgentBulk: 'Bulk Assign Agent to Contacts',
  removeAgentFromContact: 'Remove Agent from Contact',
  removeAgentBulk: 'Bulk Remove Agent from Contacts',
  getCallLogs: 'Get Call Logs',
  getCallLogById: 'Get Call Log by ID',
  getCallTranscription: 'Get Call Transcription',
  bulkDeleteCallLogs: 'Bulk Delete Call Logs',

  // Payment Gateway Config
  createPaymentGateway: 'Add Payment Gateway',
  getPaymentGateways: 'Get Payment Gateways',
  getPaymentTransactions: 'Get Payment Transactions',
  updatePaymentGateway: 'Update Payment Gateway',
  deletePaymentGateway: 'Delete Payment Gateway',
  testPaymentGateway: 'Test Payment Gateway Connection',
  reregisterWebhook: 'Re-register Payment Webhook',

  // Payment Webhooks
  handleGatewayWebhook: 'Handle Gateway Payment Webhook',

  // Testimonials
  createTestimonial: 'Create Testimonial',
  getAllTestimonials: 'Get All Testimonials',
  getTestimonialById: 'Get Testimonial by ID',
  updateTestimonial: 'Update Testimonial',
  updateTestimonialStatus: 'Toggle Testimonial Status',
  deleteTestimonial: 'Delete Testimonials',

  // Contact Inquiries
  createInquiry: 'Submit Contact Inquiry',
  getInquiries: 'Get All Inquiries',
  getInquiryById: 'Get Inquiry by ID',
  deleteInquiry: 'Delete Inquiry',
  updateInquiryStatus: 'Update Inquiry Status',

  // User Settings
  getUserSettings: 'Get My User Settings',
  updateUserSettings: 'Update My User Settings',

  // Submissions
  getSubmissions: 'Get Form Submissions',
  getSubmissionById: 'Get Submission Details',
  getSubmissionStats: 'Get Submission Statistics',
  updateSubmissionStatus: 'Update Submission Status',
  deleteSubmission: 'Delete Submission',
  getSubmissionFunnels: 'Get Submission Funnels',
  getSubmissionFunnelStatus: 'Get Submission Funnel Status',
  handleSubmissionFunnelAction: 'Move Submission in Funnel',

  // AI Assistance
  generateAIText: 'Generate AI Text',
  correctGrammar: 'AI Grammar Correction',
  summarizeText: 'AI Text Summarization',

  // AI Models
  getAIModels: 'Get All AI Models',
  createAIModel: 'Add AI Model Configuration',
  getAIModelById: 'Get AI Model by ID',
  updateAIModel: 'Update AI Model',
  deleteAIModel: 'Delete AI Model',
  testAIModel: 'Test AI Model Connection',
  getDefaultAIModel: 'Get Default AI Model',

  // Agent Tasks
  createTask: 'Create Agent Task',
  getTasks: 'Get All Tasks',
  getTaskById: 'Get Task by ID',
  updateTask: 'Update Task',
  deleteTask: 'Delete Task',
  assignTask: 'Assign Task to Agent',
  updateTaskStatus: 'Update Task Status',
  getMyTasks: 'Get My Assigned Tasks',
  bulkDeleteTasks: 'Bulk Delete Tasks',

  // Taxes
  createTax: 'Create Tax Rate',
  getAllTaxes: 'Get All Taxes',
  getTaxById: 'Get Tax by ID',
  updateTax: 'Update Tax Rate',
  deleteTax: 'Delete Tax',
  bulkDeleteTaxes: 'Bulk Delete Taxes',
};

// ═══════════════════════════════════════════════
// EXAMPLE REQUEST BODIES — Realistic dummy data
// ═══════════════════════════════════════════════
const EXAMPLE_BODIES = {
  register: { name: "John Doe", email: "john@example.com", phone: "9876543210", countryCode: "+91", password: "SecurePass@123" },
  login: { identifier: "john@example.com", password: "SecurePass@123" },
  verifyOTP: { email: "john@example.com", otp: "123456" },
  resendOTP: { email: "john@example.com" },
  forgotPassword: { email: "john@example.com" },
  resetPassword: { email: "john@example.com", otp: "123456", new_password: "NewSecurePass@456" },
  resetPasswordViaToken: { token: "eyJhbGciOiJIUzI1NiIs...", new_password: "NewSecurePass@456" },
  changePassword: { current_password: "OldPass@123", new_password: "NewPass@456" },
  updateProfile: { name: "John Doe Updated", phone: "9876543211" },

  createUser: { name: "Jane Smith", email: "jane@company.com", phone: "9876543212", password: "UserPass@123", role_id: "665a1b2c3d4e5f6a7b8c9d0e" },
  updateUser: { name: "Jane Smith Updated", phone: "9876543213", is_active: true },

  createContact: { name: "Alice Johnson", phone: "919876543214", email: "alice@example.com", tags: ["customer", "vip"], custom_fields: { company: "Acme Corp" } },
  updateContact: { name: "Alice Johnson Updated", email: "alice.updated@example.com", tags: ["customer", "premium"] },
  importContacts: { file: "(CSV/Excel file)", waba_id: "665a1b2c3d4e5f6a7b8c9d0e", tag_ids: ["665a1b2c3d4e5f6a7b8c9d0f"] },
  bulkTagContacts: { contact_ids: ["665a1b2c3d4e5f6a7b8c9d10", "665a1b2c3d4e5f6a7b8c9d11"], tag_ids: ["665a1b2c3d4e5f6a7b8c9d12"] },

  createTag: { name: "VIP Customer", color: "#FF6B35", description: "High-value customers" },
  updateTag: { name: "VIP Customer Updated", color: "#4CAF50" },

  sendMessage: { phone: "919876543214", waba_id: "665a1b2c3d4e5f6a7b8c9d0e", type: "text", message: "Hello! Welcome to our service.", template_name: null },
  assignChatToAgent: { contact_id: "665a1b2c3d4e5f6a7b8c9d10", agent_id: "665a1b2c3d4e5f6a7b8c9d11" },
  connectWhatsApp: { type: "cloud_api", waba_id: "665a1b2c3d4e5f6a7b8c9d0e", access_token: "EAABs...", phone_number_id: "123456789" },

  createTemplate: { name: "welcome_message", language: "en", category: "MARKETING", components: [{ type: "HEADER", format: "TEXT", text: "Welcome!" }, { type: "BODY", text: "Hi {{1}}, thank you for joining us!" }] },
  updateTemplate: { components: [{ type: "BODY", text: "Hi {{1}}, welcome aboard!" }] },

  createCampaign: { name: "Summer Sale 2024", template_id: "665a1b2c3d4e5f6a7b8c9d0e", segment_id: "665a1b2c3d4e5f6a7b8c9d0f", scheduled_at: "2024-07-15T10:00:00Z", waba_id: "665a1b2c3d4e5f6a7b8c9d10" },

  createAutomation: { name: "Welcome Flow", description: "Automated welcome message for new contacts", trigger: { type: "new_contact" }, actions: [{ type: "send_message", template_id: "665a1b2c3d4e5f6a7b8c9d0e" }], is_active: true },

  createPlan: { name: "Professional", description: "For growing businesses", price: 49.99, billing_cycle: "monthly", features: { conversations: 5000, agents: 10, automations: 50 }, is_active: true },
  updatePlan: { name: "Professional Plus", price: 59.99 },

  createStripeSubscription: { plan_id: "665a1b2c3d4e5f6a7b8c9d0e", payment_method_id: "pm_1234567890" },
  createRazorpaySubscription: { plan_id: "665a1b2c3d4e5f6a7b8c9d0e" },
  createManualSubscription: { plan_id: "665a1b2c3d4e5f6a7b8c9d0e", payment_proof: "Transaction ID: TXN123456", amount: 49.99 },
  changePlan: { new_plan_id: "665a1b2c3d4e5f6a7b8c9d0f" },
  overrideLimits: { conversations: 10000, agents: 25, automations: 100 },
  assignSubscription: { user_id: "665a1b2c3d4e5f6a7b8c9d10", plan_id: "665a1b2c3d4e5f6a7b8c9d0e", duration_months: 12 },

  updateSettings: { app_name: "ChatWave", support_email: "support@chatwave.com", smtp_host: "smtp.gmail.com", smtp_port: 587, smtp_user: "noreply@chatwave.com", smtp_password: "app_password" },
  testMailSettings: { test_email: "admin@chatwave.com" },

  createWorkspace: { name: "Acme Corp Workspace", description: "Primary business workspace" },
  updateWorkspace: { name: "Acme Corp - Updated" },

  createRole: { name: "Sales Manager", description: "Can manage contacts and campaigns", permissions: ["view.contacts", "create.contacts", "view.campaigns", "create.campaigns"] },
  updateRole: { name: "Senior Sales Manager", permissions: ["view.contacts", "create.contacts", "update.contacts", "view.campaigns", "create.campaigns", "update.campaigns"] },

  createTeam: { name: "Sales Team", description: "Handles customer inquiries and sales", members: ["665a1b2c3d4e5f6a7b8c9d10"], permissions: ["manage.conversations", "view.contacts"] },

  createWidget: { name: "Website Chat Widget", phone_number_id: "665a1b2c3d4e5f6a7b8c9d0e", welcome_message: "Hi! How can we help you?", theme_color: "#25D366", position: "bottom-right" },

  createShortLink: { name: "Product Inquiry", phone: "919876543210", message: "Hi, I want to know about your products", utm_source: "website", utm_medium: "chat_button" },

  createSegment: { name: "Active Customers", description: "Customers who messaged in last 30 days", conditions: { operator: "AND", rules: [{ field: "last_message_at", operator: "greater_than", value: "30_days_ago" }] } },

  createKanbanFunnel: { name: "Sales Pipeline", stages: [{ name: "New Lead", color: "#3B82F6", order: 1 }, { name: "Qualified", color: "#F59E0B", order: 2 }, { name: "Won", color: "#10B981", order: 3 }] },
  moveKanbanItem: { item_id: "665a1b2c3d4e5f6a7b8c9d10", from_stage_id: "665a1b2c3d4e5f6a7b8c9d11", to_stage_id: "665a1b2c3d4e5f6a7b8c9d12", position: 0 },

  startImpersonation: { user_id: "665a1b2c3d4e5f6a7b8c9d10" },

  createFaq: { question: "How do I connect WhatsApp?", answer: "Go to Settings > WhatsApp > Connect and follow the setup wizard.", category: "Getting Started", order: 1 },

  createQuickReply: { title: "Greeting", message: "Hello! Thank you for reaching out. How can I assist you today?", shortcut: "/hello" },

  upsertWorkingHours: { waba_id: "665a1b2c3d4e5f6a7b8c9d0e", timezone: "Asia/Kolkata", hours: { monday: { enabled: true, start: "09:00", end: "18:00" }, sunday: { enabled: false } }, away_message: "We're currently offline. We'll get back to you during business hours." },

  createCustomField: { name: "Company Name", type: "text", required: false, placeholder: "Enter company name", options: null },

  createPaymentGateway: { provider: "stripe", api_key: "sk_live_...", webhook_secret: "whsec_...", is_active: true },

  createTax: { name: "GST", rate: 18, country: "IN", description: "Goods and Services Tax", is_active: true },

  createCurrency: { name: "Indian Rupee", code: "INR", symbol: "₹", exchange_rate: 83.5, is_active: true },

  createLanguage: { name: "Hindi", code: "hi", flag: "🇮🇳", is_active: true, is_default: false },

  createPage: { title: "Privacy Policy", slug: "privacy-policy", content: "<h1>Privacy Policy</h1><p>Your privacy is important to us...</p>", is_active: true },
};

// ═══════════════════════════════════════════════
// EXAMPLE RESPONSES
// ═══════════════════════════════════════════════
const EXAMPLE_RESPONSES = {
  login: { success: true, message: "Login successful", token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...", user: { id: "665a1b2c3d4e5f6a7b8c9d0e", name: "John Doe", email: "john@example.com", role: "owner" } },
  register: { success: true, message: "OTP sent to your email for verification" },
  getProfile: { success: true, data: { id: "665a1b2c3d4e5f6a7b8c9d0e", name: "John Doe", email: "john@example.com", phone: "9876543210", role: "owner", avatar: null } },
  getMySubscription: { success: true, data: { plan: { name: "Professional", price: 49.99 }, status: "active", expires_at: "2025-01-15T00:00:00Z", usage: { conversations: { used: 1250, limit: 5000 } } } },
};

// ═══════════════════════════════════════════════
// FORMDATA FIELDS for file-upload endpoints
// ═══════════════════════════════════════════════
const FORMDATA_FIELDS = {
  sendMessage: [
    { key: 'phone', value: '919876543214', type: 'text', description: 'Recipient phone number with country code' },
    { key: 'waba_id', value: '665a1b2c3d4e5f6a7b8c9d0e', type: 'text', description: 'WABA ID to send from' },
    { key: 'type', value: 'text', type: 'text', description: 'Message type: text, image, document, audio, video, template, interactive' },
    { key: 'message', value: 'Hello! Welcome to our service.', type: 'text', description: 'Message text content' },
    { key: 'template_name', value: '', type: 'text', description: 'Template name (if type is template)', disabled: true },
    { key: 'file_url', type: 'file', src: '', description: 'Media file (image, document, audio, video)' },
    { key: 'carousel_files', type: 'file', src: '', description: 'Carousel images (multiple files)', disabled: true },
  ],
  createWidget: [
    { key: 'name', value: 'Website Chat Widget', type: 'text', description: 'Widget name' },
    { key: 'phone_number_id', value: '665a1b2c3d4e5f6a7b8c9d0e', type: 'text', description: 'Phone number ID' },
    { key: 'welcome_message', value: 'Hi! How can we help?', type: 'text', description: 'Welcome message' },
    { key: 'theme_color', value: '#25D366', type: 'text', description: 'Widget theme color' },
    { key: 'position', value: 'bottom-right', type: 'text', description: 'Widget position on page' },
    { key: 'widget_image', type: 'file', src: '', description: 'Widget avatar/logo image' },
    { key: 'body_background_image', type: 'file', src: '', description: 'Chat body background image' },
  ],
  updateWidget: [
    { key: 'name', value: 'Updated Widget', type: 'text', description: 'Widget name' },
    { key: 'welcome_message', value: 'Welcome! Chat with us.', type: 'text', description: 'Welcome message' },
    { key: 'theme_color', value: '#4CAF50', type: 'text', description: 'Widget theme color' },
    { key: 'widget_image', type: 'file', src: '', description: 'Widget avatar image' },
    { key: 'body_background_image', type: 'file', src: '', description: 'Background image' },
  ],
  createTemplate: [
    { key: 'name', value: 'welcome_message', type: 'text', description: 'Template name (lowercase, underscores)' },
    { key: 'language', value: 'en', type: 'text', description: 'Template language code' },
    { key: 'category', value: 'MARKETING', type: 'text', description: 'MARKETING, UTILITY, or AUTHENTICATION' },
    { key: 'components', value: '[{"type":"BODY","text":"Hi {{1}}, welcome!"}]', type: 'text', description: 'Template components JSON' },
    { key: 'file', type: 'file', src: '', description: 'Header media file (image/video/document)' },
  ],
  updateTemplate: [
    { key: 'components', value: '[{"type":"BODY","text":"Hi {{1}}, welcome aboard!"}]', type: 'text', description: 'Updated components JSON' },
    { key: 'file', type: 'file', src: '', description: 'Updated header media file' },
    { key: 'card_media', type: 'file', src: '', description: 'Carousel card media files (up to 10)' },
  ],
  createFbAdCampaign: [
    { key: 'name', value: 'Summer CTWA Campaign', type: 'text', description: 'Campaign name' },
    { key: 'objective', value: 'MESSAGES', type: 'text', description: 'Campaign objective' },
    { key: 'ad_account_id', value: 'act_123456789', type: 'text', description: 'Facebook Ad Account ID' },
    { key: 'daily_budget', value: '5000', type: 'text', description: 'Daily budget in cents' },
    { key: 'image', type: 'file', src: '', description: 'Ad creative image' },
    { key: 'video', type: 'file', src: '', description: 'Ad creative video (optional)' },
  ],
  createFbAd: [
    { key: 'name', value: 'Ad Creative v1', type: 'text', description: 'Ad name' },
    { key: 'ad_set_id', value: '665a1b2c3d4e5f6a7b8c9d0e', type: 'text', description: 'Ad Set ID' },
    { key: 'message', value: 'Chat with us on WhatsApp!', type: 'text', description: 'Ad message text' },
    { key: 'image', type: 'file', src: '', description: 'Ad image' },
    { key: 'video', type: 'file', src: '', description: 'Ad video (optional)' },
    { key: 'carousel_images', type: 'file', src: '', description: 'Carousel images (up to 10)' },
  ],
  createTestimonial: [
    { key: 'user_name', value: 'Sarah Johnson', type: 'text', description: 'Customer name' },
    { key: 'user_title', value: 'CEO, Acme Corp', type: 'text', description: 'Customer title' },
    { key: 'content', value: 'ChatWave transformed our customer engagement!', type: 'text', description: 'Testimonial text' },
    { key: 'rating', value: '5', type: 'text', description: 'Rating (1-5)' },
    { key: 'user_image', type: 'file', src: '', description: 'Customer profile photo' },
  ],
  updateTestimonial: [
    { key: 'user_name', value: 'Sarah Johnson', type: 'text', description: 'Updated name' },
    { key: 'content', value: 'Updated testimonial content', type: 'text', description: 'Updated text' },
    { key: 'user_image', type: 'file', src: '', description: 'Updated profile photo' },
  ],
  uploadAttachment: [
    { key: 'file', type: 'file', src: '', description: 'File to upload (image, PDF, audio, video — max 16MB)' },
    { key: 'type', value: 'image', type: 'text', description: 'File type: image, document, audio, video' },
    { key: 'waba_id', value: '665a1b2c3d4e5f6a7b8c9d0e', type: 'text', description: 'WABA ID for WhatsApp media upload' },
  ],
  uploadMediaToWhatsApp: [
    { key: 'file', type: 'file', src: '', description: 'Media file to upload to WhatsApp' },
    { key: 'type', value: 'image/jpeg', type: 'text', description: 'MIME type of the file' },
    { key: 'waba_id', value: '665a1b2c3d4e5f6a7b8c9d0e', type: 'text', description: 'WABA ID' },
  ],
  importContacts: [
    { key: 'file', type: 'file', src: '', description: 'CSV or Excel file with contacts' },
    { key: 'waba_id', value: '665a1b2c3d4e5f6a7b8c9d0e', type: 'text', description: 'WABA ID for contact association' },
    { key: 'tag_ids', value: '665a1b2c3d4e5f6a7b8c9d0f', type: 'text', description: 'Tag IDs to assign (comma-separated)' },
    { key: 'duplicate_action', value: 'skip', type: 'text', description: 'Action for duplicates: skip, update, or create' },
  ],
  createReplyMaterial: [
    { key: 'name', value: 'Product Brochure', type: 'text', description: 'Material name' },
    { key: 'type', value: 'document', type: 'text', description: 'Type: image, document, audio, video' },
    { key: 'file', type: 'file', src: '', description: 'Material file' },
  ],
  updateReplyMaterial: [
    { key: 'name', value: 'Updated Brochure', type: 'text', description: 'Updated material name' },
    { key: 'file', type: 'file', src: '', description: 'Updated file' },
  ],
  updateUserSettings: [
    { key: 'notification_sound', value: 'true', type: 'text', description: 'Enable notification sounds' },
    { key: 'chat_background', value: '#1a1a2e', type: 'text', description: 'Chat background color' },
    { key: 'bg_image', type: 'file', src: '', description: 'Custom chat background image' },
  ],
  uploadLandingImage: [
    { key: 'file', type: 'file', src: '', description: 'Landing page image (hero, feature, etc.)' },
    { key: 'section', value: 'hero', type: 'text', description: 'Section: hero, features, testimonials' },
  ],
  createAdminTemplate: [
    { key: 'name', value: 'welcome_template', type: 'text', description: 'Template name' },
    { key: 'category', value: 'MARKETING', type: 'text', description: 'Template category' },
    { key: 'language', value: 'en', type: 'text', description: 'Template language' },
    { key: 'components', value: '[{"type":"BODY","text":"Hello {{1}}!"}]', type: 'text', description: 'Components JSON' },
    { key: 'file', type: 'file', src: '', description: 'Header media file' },
  ],
  updateLandingPageConfig: [
    { key: 'hero_title', value: 'Grow Your Business with WhatsApp', type: 'text', description: 'Hero section title' },
    { key: 'hero_subtitle', value: 'All-in-one WhatsApp Business Platform', type: 'text', description: 'Hero subtitle' },
  ],
  updateSettings: [
    { key: 'app_name', value: 'ChatWave', type: 'text', description: 'Application name' },
    { key: 'support_email', value: 'support@chatwave.com', type: 'text', description: 'Support email' },
  ],
  createCampaign: [
    { key: 'name', value: 'Summer Sale 2024', type: 'text', description: 'Campaign name' },
    { key: 'template_id', value: '665a1b2c3d4e5f6a7b8c9d0e', type: 'text', description: 'Message template ID' },
    { key: 'segment_id', value: '665a1b2c3d4e5f6a7b8c9d0f', type: 'text', description: 'Target contact segment ID' },
    { key: 'waba_id', value: '665a1b2c3d4e5f6a7b8c9d10', type: 'text', description: 'WABA ID to send from' },
    { key: 'scheduled_at', value: '2024-07-15T10:00:00Z', type: 'text', description: 'Scheduled send time (ISO 8601)' },
    { key: 'file_url', type: 'file', src: '', description: 'Media file for header (image/video/document)' },
    { key: 'carousel_files', type: 'file', src: '', description: 'Carousel card images (multiple)', disabled: true },
  ],
};

// ═══════════════════════════════════════════════
// ROUTE PARSER
// ═══════════════════════════════════════════════
function parseRoutes() {
  const allRoutes = [];
  const routeFiles = fs.readdirSync(ROUTES_DIR).filter(f => f.endsWith('.js'));

  for (const file of routeFiles) {
    const basename = file.replace('.js', '');
    const prefix = ROUTE_PREFIX_MAP[basename] || `/api/${basename}`;
    const tag = ROUTE_TO_TAG[basename] || basename;
    const content = fs.readFileSync(path.join(ROUTES_DIR, file), 'utf8');
    
    // Pre-process: join multiline router statements into single lines
    // This handles cases like router.post('/', upload.fields([\n...\n]), handler);
    const joinedContent = content.replace(/router\.(get|post|put|patch|delete)\s*\([^;]*?\)\s*;/gs, match => {
      return match.replace(/\s*\n\s*/g, ' ');
    });
    const lines = joinedContent.split('\n');

    const hasRouterAuth = content.includes('router.use(authenticate)');

    // Track current router.route() path
    let currentRoutePath = null;

    for (const line of lines) {
      // Handle router.route("/path") pattern
      const routeRouteMatch = line.match(/router\.route\s*\(\s*["']([^"']+)["']\s*\)/);
      if (routeRouteMatch) {
        currentRoutePath = routeRouteMatch[1];
      }

      // Handle chained .get(), .post() etc on router.route()
      let method, routePath;
      const chainedMatch = line.match(/^\s*\.(get|post|put|patch|delete)\s*\(/);
      if (chainedMatch && currentRoutePath) {
        method = chainedMatch[1].toUpperCase();
        routePath = currentRoutePath;
      } else {
        // Standard router.get('/path', ...) pattern
        const routeMatch = line.match(/router\.(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/);
        if (!routeMatch) continue;
        method = routeMatch[1].toUpperCase();
        routePath = routeMatch[2];
        currentRoutePath = null; // reset
      }

      const fullPath = `${prefix}${routePath === '/' ? '' : routePath}`;

      // Extract handler function name — try multiple patterns
      let funcName = 'handler';
      
      // Pattern 1: controller.method
      const ctrlMatch = line.match(/(?:\w+(?:Controller|controller|Controller))\s*\.\s*(\w+)/);
      if (ctrlMatch) {
        funcName = ctrlMatch[1];
      } else {
        // Pattern 2: direct function name at end of line
        const directMatch = line.match(/,\s*(\w+)\s*\)\s*;?\s*$/);
        if (directMatch && !['authenticate', 'authorizeAdmin', 'requireSubscription'].includes(directMatch[1])) {
          funcName = directMatch[1];
        } else {
          // Pattern 3: last word before closing paren
          const allWords = [...line.matchAll(/[\.\s,](\w+)\s*(?:[,\)])/g)];
          const reserved = ['authenticate', 'authorizeAdmin', 'checkPermission', 'requireSubscription', 'checkPlanLimit', 'express', 'json', 'upload', 'uploader', 'uploadSingle', 'fields', 'single', 'maxCount'];
          for (let i = allWords.length - 1; i >= 0; i--) {
            const w = allWords[i][1];
            if (!reserved.includes(w) && !w.match(/^(get|post|put|patch|delete)$/i)) {
              funcName = w;
              break;
            }
          }
        }
      }

      const requiresAuth = hasRouterAuth || line.includes('authenticate') || line.includes('authenticateUser');
      const permMatch = line.match(/checkPermission\(['"]([^'"]+)['"]\)/);
      const planMatch = line.match(/checkPlanLimit\(['"]([^'"]+)['"]\)/);
      // Only detect file upload when multer or uploader utility is explicitly used
      const hasUpload = line.includes('uploader(') || line.includes('uploadSingle(') || line.includes('upload.single(') || line.includes('upload.fields(');

      const displayName = FUNC_NAME_MAP[funcName] || camelToTitle(funcName);

      allRoutes.push({
        method, path: fullPath, tag, funcName, displayName,
        requiresAuth, permission: permMatch?.[1] || null,
        planLimit: planMatch?.[1] || null, hasFileUpload: hasUpload,
        routeFile: file,
      });
    }
  }

  // Add inline routes from app.js
  const inlineRoutes = [
    { method: 'GET', path: '/', tag: 'System', funcName: 'healthCheck', displayName: 'Health Check', requiresAuth: false },
    { method: 'GET', path: '/api/is-demo-mode', tag: 'System', funcName: 'isDemoMode', displayName: 'Check Demo Mode Status', requiresAuth: false },
    { method: 'POST', path: '/api/webhook/stripe', tag: 'Payment Webhooks', funcName: 'handleStripeWebhook', displayName: 'Stripe Payment Webhook', requiresAuth: false },
    { method: 'POST', path: '/api/webhook/razorpay', tag: 'Payment Webhooks', funcName: 'handleRazorpayWebhook', displayName: 'Razorpay Payment Webhook', requiresAuth: false },
    { method: 'POST', path: '/api/webhook/paypal', tag: 'Payment Webhooks', funcName: 'handlePayPalWebhook', displayName: 'PayPal Payment Webhook', requiresAuth: false },
    { method: 'GET', path: '/short_link/wp/:code', tag: 'Short Links', funcName: 'redirectShortLink', displayName: 'Redirect Short Link', requiresAuth: false },
    { method: 'GET', path: '/webhook/whatsapp', tag: 'WhatsApp Webhooks', funcName: 'handleWebhookVerification', displayName: 'WhatsApp Webhook Verification (GET)', requiresAuth: false },
    { method: 'POST', path: '/webhook/whatsapp', tag: 'WhatsApp Webhooks', funcName: 'handleIncomingMessage', displayName: 'WhatsApp Incoming Message Webhook', requiresAuth: false },
  ];
  for (const r of inlineRoutes) {
    allRoutes.push({ ...r, routeFile: 'app.js', permission: null, planLimit: null, hasFileUpload: false });
  }

  return allRoutes;
}

function camelToTitle(str) {
  return str
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .replace(/_/g, ' ')
    .trim();
}

function convertPathToOpenAPI(p) { return p.replace(/:(\w+)/g, '{$1}'); }

function extractPathParams(p) {
  const params = [];
  const regex = /:(\w+)/g;
  let m;
  while ((m = regex.exec(p)) !== null) {
    params.push({ name: m[1], in: 'path', required: true, schema: { type: 'string' }, description: `Unique ${m[1].replace(/_/g, ' ')} identifier` });
  }
  return params;
}

// ═══════════════════════════════════════════════
// SWAGGER GENERATOR
// ═══════════════════════════════════════════════
function generateSwagger(routes) {
  const tags = [];
  const tagSet = new Set();
  const paths = {};

  for (const route of routes) {
    if (!tagSet.has(route.tag)) {
      tagSet.add(route.tag);
      tags.push({ name: route.tag, description: TAG_DESCRIPTIONS[route.tag] || route.tag });
    }

    const oaPath = convertPathToOpenAPI(route.path);
    const method = route.method.toLowerCase();
    if (!paths[oaPath]) paths[oaPath] = {};

    const op = {
      tags: [route.tag],
      summary: route.displayName,
      operationId: route.funcName,
      parameters: [...extractPathParams(route.path)],
      responses: {
        '200': { description: 'Success', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, message: { type: 'string' }, data: { type: 'object' } } } } } },
        '400': { description: 'Bad Request' },
        '500': { description: 'Internal Server Error' }
      }
    };

    let desc = '';
    if (route.permission) desc += `**Permission Required:** \`${route.permission}\`\n\n`;
    if (route.planLimit) desc += `**Plan Limit:** \`${route.planLimit}\`\n\n`;
    if (route.requiresAuth) desc += 'Requires Bearer JWT token or API Key in header.\n';
    if (desc) op.description = desc.trim();

    if (route.requiresAuth) {
      op.security = [{ BearerAuth: [] }, { ApiKeyAuth: [] }];
      op.responses['401'] = { description: 'Unauthorized — Invalid or missing token' };
      op.responses['403'] = { description: 'Forbidden — Insufficient permissions' };
    }

    if (['POST', 'PUT', 'PATCH'].includes(route.method)) {
      const exampleBody = EXAMPLE_BODIES[route.funcName];
      if (route.hasFileUpload) {
        op.requestBody = { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } } } };
      } else {
        op.requestBody = { required: true, content: { 'application/json': { schema: { type: 'object' }, ...(exampleBody ? { example: exampleBody } : {}) } } };
      }
    }

    if (method === 'get' && !extractPathParams(route.path).length) {
      op.parameters.push(
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 }, description: 'Page number for pagination' },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 }, description: 'Number of items per page' },
        { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Search keyword to filter results' },
        { name: 'sort_by', in: 'query', schema: { type: 'string', default: 'created_at' }, description: 'Field to sort by' },
        { name: 'sort_order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' }, description: 'Sort direction' }
      );
    }

    const exampleResp = EXAMPLE_RESPONSES[route.funcName];
    if (exampleResp) {
      op.responses['200'] = { description: 'Success', content: { 'application/json': { schema: { type: 'object' }, example: exampleResp } } };
    }

    paths[oaPath][method] = op;
  }

  return {
    openapi: '3.0.3',
    info: {
      title: 'ChatWave Backend API',
      description: 'Complete REST API documentation for ChatWave — a WhatsApp Business Platform with CRM, Automation, Ecommerce, Broadcasting, and Team Collaboration features.\n\n## Authentication\n- **JWT Token**: Send `Authorization: Bearer <token>` header\n- **API Key**: Send `x-api-key: <key>` header or `Authorization: ApiKey <key>`\n\n## Base URLs\n- Local: `http://localhost:5000`\n- Production: `https://api.yourdomain.com`',
      version: '1.0.0',
      contact: { name: 'ChatWave API Support', email: 'api-support@chatwave.com' },
    },
    servers: [
      { url: 'http://localhost:5000', description: 'Local Development Server' },
      { url: 'https://api.chatwave.com', description: 'Production Server' }
    ],
    tags: tags.sort((a, b) => a.name.localeCompare(b.name)),
    paths,
    components: {
      securitySchemes: {
        BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'JWT token from POST /api/auth/login' },
        ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'x-api-key', description: 'API key from Developer API Keys section' }
      }
    }
  };
}

// ═══════════════════════════════════════════════
// POSTMAN COLLECTION GENERATOR
// ═══════════════════════════════════════════════
function generatePostman(routes) {
  const folders = {};

  for (const route of routes) {
    if (!folders[route.tag]) folders[route.tag] = [];

    const pathParts = route.path.split('/').filter(Boolean);
    const urlObj = {
      raw: `{{baseUrl}}${route.path}`,
      host: ['{{baseUrl}}'],
      path: pathParts.map(seg => seg.startsWith(':') ? `:${seg.slice(1)}` : seg),
    };

    // Path variables
    const pathVars = [];
    for (const seg of pathParts) {
      if (seg.startsWith(':')) {
        const varName = seg.slice(1);
        pathVars.push({ key: varName, value: '665a1b2c3d4e5f6a7b8c9d0e', description: `${varName.replace(/_/g, ' ')} identifier` });
      }
    }
    if (pathVars.length) urlObj.variable = pathVars;

    // Query params for GET list endpoints
    if (route.method === 'GET' && pathVars.length === 0) {
      urlObj.query = [
        { key: 'page', value: '1', description: 'Page number' },
        { key: 'limit', value: '10', description: 'Items per page' },
        { key: 'search', value: '', description: 'Search keyword', disabled: true },
        { key: 'sort_by', value: 'created_at', description: 'Sort field', disabled: true },
        { key: 'sort_order', value: 'desc', description: 'Sort direction (asc/desc)', disabled: true },
      ];
    }

    const headers = [];
    if (route.requiresAuth) {
      headers.push({ key: 'Authorization', value: 'Bearer {{authToken}}', type: 'text', description: 'JWT auth token' });
    }

    const item = {
      name: route.displayName,
      request: {
        method: route.method,
        header: headers,
        url: urlObj,
        description: buildRequestDescription(route),
      },
      response: []
    };

    // Request body
    if (['POST', 'PUT', 'PATCH'].includes(route.method)) {
      const exampleBody = EXAMPLE_BODIES[route.funcName];
      if (route.hasFileUpload) {
        const formdataFields = FORMDATA_FIELDS[route.funcName] || [
          { key: 'file', type: 'file', src: '', description: 'File to upload' }
        ];
        item.request.body = {
          mode: 'formdata',
          formdata: formdataFields
        };
      } else {
        headers.push({ key: 'Content-Type', value: 'application/json', type: 'text' });
        item.request.body = {
          mode: 'raw',
          raw: JSON.stringify(exampleBody || {}, null, 2),
          options: { raw: { language: 'json' } }
        };
      }
    }

    // Example responses
    const exampleResp = EXAMPLE_RESPONSES[route.funcName];
    if (exampleResp) {
      item.response.push({
        name: `${route.displayName} - Success`,
        originalRequest: item.request,
        status: 'OK',
        code: 200,
        header: [{ key: 'Content-Type', value: 'application/json' }],
        body: JSON.stringify(exampleResp, null, 2)
      });
    }

    folders[route.tag].push(item);
  }

  return {
    info: {
      name: 'ChatWave Backend API',
      description: 'Complete production-ready API collection for ChatWave — WhatsApp Business Platform.\n\nIncludes 486+ endpoints organized by module with realistic request bodies and authentication.\n\n## Setup\n1. Import this collection into Postman\n2. Create an environment with variables: `baseUrl`, `authToken`\n3. Run "Login with Email/Phone" to get your auth token\n4. Set `authToken` variable with the received JWT token\n\n## Authentication\n- Most endpoints require `Authorization: Bearer <token>` header\n- Alternatively use `x-api-key: <key>` header',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      version: '1.0.0',
    },
    item: Object.entries(folders)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([folderName, items]) => ({
        name: folderName,
        description: TAG_DESCRIPTIONS[folderName] || '',
        item: items,
      })),
    variable: [
      { key: 'baseUrl', value: 'http://localhost:5000', type: 'string', description: 'Base URL of the ChatWave Backend API' },
      { key: 'authToken', value: '', type: 'string', description: 'JWT authentication token (obtained from Login endpoint)' },
    ],
    auth: {
      type: 'bearer',
      bearer: [{ key: 'token', value: '{{authToken}}', type: 'string' }]
    },
    event: [
      {
        listen: 'prerequest',
        script: { type: 'text/javascript', exec: [''] }
      },
      {
        listen: 'test',
        script: {
          type: 'text/javascript',
          exec: [
            '// Auto-save auth token on login',
            'if (pm.request.url.toString().includes("/api/auth/login") && pm.response.code === 200) {',
            '    const response = pm.response.json();',
            '    if (response.token) {',
            '        pm.collectionVariables.set("authToken", response.token);',
            '        console.log("Auth token saved automatically!");',
            '    }',
            '}'
          ]
        }
      }
    ]
  };
}

function buildRequestDescription(route) {
  let desc = '';
  if (route.requiresAuth) desc += '🔒 **Authentication Required** — Bearer JWT Token or API Key\n\n';
  else desc += '🌐 **Public Endpoint** — No authentication required\n\n';
  
  if (route.permission) desc += `📋 **Permission:** \`${route.permission}\`\n\n`;
  if (route.planLimit) desc += `💎 **Plan Limit:** \`${route.planLimit}\` — Requires active subscription with available quota\n\n`;
  
  desc += `**Source:** \`${route.routeFile}\`\n`;
  desc += `**Handler:** \`${route.funcName}\``;
  
  return desc;
}

// ═══════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════
console.log('🔍 Parsing all route files...\n');
const routes = parseRoutes();
const uniqueTags = new Set(routes.map(r => r.tag));
console.log(`✅ Found ${routes.length} endpoints across ${uniqueTags.size} modules\n`);

console.log('📝 Generating OpenAPI 3.0 (Swagger)...');
const swagger = generateSwagger(routes);
fs.writeFileSync(path.join(__dirname, 'swagger.json'), JSON.stringify(swagger, null, 2));
console.log(`✅ swagger.json — ${Object.keys(swagger.paths).length} paths, ${swagger.tags.length} tags\n`);

console.log('📮 Generating Postman Collection v2.1...');
const postman = generatePostman(routes);
fs.writeFileSync(path.join(__dirname, 'postman-collection.json'), JSON.stringify(postman, null, 2));
const totalReqs = postman.item.reduce((a, f) => a + f.item.length, 0);
console.log(`✅ postman-collection.json — ${postman.item.length} folders, ${totalReqs} requests\n`);

// Print summary
console.log('═'.repeat(60));
console.log('📊 MODULE SUMMARY');
console.log('═'.repeat(60));
const byTag = {};
for (const r of routes) { if (!byTag[r.tag]) byTag[r.tag] = []; byTag[r.tag].push(r); }
for (const [tag, tagRoutes] of Object.entries(byTag).sort(([a], [b]) => a.localeCompare(b))) {
  const authCount = tagRoutes.filter(r => r.requiresAuth).length;
  console.log(`  ${tag.padEnd(35)} ${String(tagRoutes.length).padStart(3)} endpoints  (${authCount} protected)`);
}
console.log('═'.repeat(60));
console.log(`  ${'TOTAL'.padEnd(35)} ${String(routes.length).padStart(3)} endpoints`);
console.log('\n✅ Documentation generation complete!');
