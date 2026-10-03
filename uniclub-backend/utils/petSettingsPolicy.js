// Account preferences and skin IDs share one frontend/backend whitelist.
const definition = require('../../shared/pet-settings.json');
const { resolveNotifications, notificationPatch } = require('./accountSettingsPolicy');
const PET_DEFAULTS = Object.freeze(definition.defaults);
const PET_KEYS = Object.keys(PET_DEFAULTS);
const GENERAL_SETTINGS = {
  profileVisibility: value => ['public', 'club-members', 'private'].includes(value),
  emailNotifications: value => typeof value === 'boolean',
  commentNotifications: value => typeof value === 'boolean',
};

function validPetValue(key, value) {
  const fallback = PET_DEFAULTS[key];
  if (typeof value !== typeof fallback) return false;
  if (definition.ranges[key]) {
    const [min, max] = definition.ranges[key];
    return Number.isFinite(value) && value >= min && value <= max && (key === 'petOpacity' || Number.isInteger(value));
  }
  if (key === 'petSkin') return definition.skins.includes(value);
  if (key === 'petActivity') return definition.activities.includes(value);
  if (key === 'petPokeAction' || key === 'petCelebrateAction') return definition.actions.includes(value);
  return true;
}

function resolveUserSettings(settings = {}) {
  const resolved = {};
  for (const key of Object.keys(GENERAL_SETTINGS)) {
    if (GENERAL_SETTINGS[key](settings?.[key])) resolved[key] = settings[key];
  }
  for (const key of PET_KEYS) resolved[key] = validPetValue(key, settings?.[key]) ? settings[key] : PET_DEFAULTS[key];
  resolved.notifications = resolveNotifications(settings?.notifications);
  return resolved;
}

function validateSettingsPatch(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.keys(body).length) {
    return { error: '请提交需要修改的个人设置。' };
  }
  const patch = {};
  for (const [key, value] of Object.entries(body)) {
    if (key === 'notifications') {
      const fields = notificationPatch(value);
      if (!fields) return { error: '通知设置字段不合法。' };
      Object.assign(patch, fields); continue;
    }
    const valid = PET_KEYS.includes(key) ? validPetValue(key, value)
      : Object.hasOwn(GENERAL_SETTINGS, key) && GENERAL_SETTINGS[key](value);
    if (!valid) return { error: `个人设置字段不合法：${key}` };
    patch[`settings.${key}`] = value;
  }
  return { patch };
}

const petSchemaFields = Object.fromEntries(PET_KEYS.map(key => {
  const value = PET_DEFAULTS[key];
  const field = { type: typeof value === 'boolean' ? Boolean : typeof value === 'number' ? Number : String, default: value };
  if (definition.ranges[key]) {
    [field.min, field.max] = definition.ranges[key];
    field.validate = { validator: next => validPetValue(key, next), message: `Invalid ${key}` };
  }
  if (key === 'petSkin') field.enum = definition.skins;
  if (key === 'petActivity') field.enum = definition.activities;
  if (key === 'petPokeAction' || key === 'petCelebrateAction') field.enum = definition.actions;
  return [key, field];
}));

module.exports = { PET_DEFAULTS, PET_KEYS, petSchemaFields, resolveUserSettings, validateSettingsPatch };
