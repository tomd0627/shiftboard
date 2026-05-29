export default {
  extends: ['stylelint-config-standard'],
  plugins: ['stylelint-order'],
  rules: {
    'color-named': 'never',
    'order/properties-alphabetical-order': true,
    // Allow BEM modifier syntax (block__element--modifier)
    'selector-class-pattern': [
      '^[a-z][a-z0-9-]*(__[a-z][a-z0-9-]*)?(--[a-z][a-z0-9-]*)?$',
      { message: 'Expected BEM-style class selector' },
    ],
  },
};
