export type WithPlugin<Type, Plugin> = Type & {
  [Property in keyof Plugin as `__plugins_${string & Property}`]?: Plugin[Property];
}

export type WithProperties<Type, AdditionalProperties> = Type & AdditionalProperties;

export declare function addPlugin<Type, Plugin>(obj: Type): WithPlugin<Type, Plugin>;
export declare function addProperties<Type, AdditionalProperties>(obj: Type): WithProperties<Type, AdditionalProperties>;
