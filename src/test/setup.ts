import '@testing-library/jest-dom/vitest';

// jsdom no implementa scrollIntoView y Radix Select lo llama al abrir el
// dropdown (para dejar visible el item enfocado). Sin esto, cualquier test que
// abra un <Select> revienta con "candidate?.scrollIntoView is not a function".
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}
