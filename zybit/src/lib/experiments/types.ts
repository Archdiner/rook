export type VariantModification =
  | { type: 'css-inject'; selector: string; css: string }
  | { type: 'text-replace'; selector: string; text: string }
  | { type: 'element-hide'; selector: string }
  | { type: 'element-show'; selector: string }
  | { type: 'attribute-set'; selector: string; attr: string; value: string }
  | { type: 'element-reorder'; parentSelector: string; childOrder: number[] };
