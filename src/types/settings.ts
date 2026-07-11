export type SettingValue = string | number | boolean | string[] | Record<string, string>;

export interface Setting {
  id: string;
  value: SettingValue;
  description: string;
  updatedBy: string;
  updatedAt: Date;
}
