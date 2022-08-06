export type WithPlugin<Type, Plugin> = Type & {
  [Property in keyof Plugin as `__plugins_${string & Property}`]?: Plugin[Property];
}

export type WithProperties<Type, AdditionalProperties> = Type & AdditionalProperties;

export function addPlugin<Type, Plugin>(obj: Type): WithPlugin<Type, Plugin> {
  return obj as WithPlugin<Type, Plugin>;
}

export function addProperties<Type, AdditionalProperties>(obj: Type): WithProperties<Type, AdditionalProperties> {
  return obj as WithProperties<Type, AdditionalProperties>;
}
