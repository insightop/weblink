import type {
  PluginConfigField,
  PluginConfigObject,
  PluginNumberField,
  PluginPresetNumberField,
  PluginSelectField,
} from "@/plugins/config/pluginConfig.types";

function validateNumberField(field: PluginNumberField, value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) throw new Error(`Invalid number for ${field.key}`);
  if (field.min != null && n < field.min) throw new Error(`Value for ${field.key} is below minimum ${field.min}`);
  if (field.max != null && n > field.max) throw new Error(`Value for ${field.key} exceeds maximum ${field.max}`);
  return n;
}

function validateSelectField(field: PluginSelectField, value: unknown): string {
  const s = String(value);
  if (!field.options.some((opt) => opt.value === s)) {
    throw new Error(`Invalid option for ${field.key}`);
  }
  return s;
}

function validatePresetNumberField(field: PluginPresetNumberField, value: unknown): number {
  const n = validateNumberField(
    {
      ...field,
      type: "number",
    },
    value,
  );
  if (field.presets.includes(n)) return n;
  if (!field.allowCustom) {
    throw new Error(`Invalid preset value for ${field.key}`);
  }
  return n;
}

export function normalizeByField(field: PluginConfigField, value: unknown): string | number | boolean {
  if (field.type === "number") return validateNumberField(field, value);
  if (field.type === "preset-number") return validatePresetNumberField(field, value);
  if (field.type === "select") return validateSelectField(field, value);
  if (field.type === "boolean") return Boolean(value);
  throw new Error(`Unsupported field type: ${(field as { type?: string }).type ?? "unknown"}`);
}

export function normalizeConfigBySchema(
  defaults: PluginConfigObject,
  schemaFields: PluginConfigField[],
  raw: Record<string, unknown> | undefined,
): PluginConfigObject {
  const result: PluginConfigObject = { ...defaults };
  for (const field of schemaFields) {
    const source = raw?.[field.key] ?? defaults[field.key];
    result[field.key] = normalizeByField(field, source);
  }
  return result;
}
