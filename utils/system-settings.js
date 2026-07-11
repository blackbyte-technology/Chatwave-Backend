'use strict';
import { Setting } from '../models/index.js';

let cachedSettings = null;

export async function loadSystemSettings() {
  if (cachedSettings) return cachedSettings;

  const settings = await Setting.find({});
  cachedSettings = settings.reduce((acc, item) => {
    acc[item.key] = item.value;
    return acc;
  }, {});
  return cachedSettings;
}

