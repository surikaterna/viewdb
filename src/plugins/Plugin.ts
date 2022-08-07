export type WithPlugin<Type, Plugin> = Type & {
  [Property in keyof Plugin as `__plugins_${string & Property}`]?: Plugin[Property];
}

export type WithProperties<Type, AdditionalProperties> = Type & AdditionalProperties;

export const addPlugin = <Type, Plugin>(obj: Type): WithPlugin<Type, Plugin> => obj as WithPlugin<Type, Plugin>;

export const addProperties = <Type, AdditionalProperties>(obj: Type): WithProperties<Type, AdditionalProperties> => obj as WithProperties<Type, AdditionalProperties>;
