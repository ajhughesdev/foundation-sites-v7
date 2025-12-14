# @foundation/core (Foundation 7)

This is the initial Foundation 7 core runtime scaffold.

## Intent

- DOM-first (no jQuery requirement)
- ESM-first (explicit exports, side-effect free by default)
- predictable lifecycle (mount + teardown, cleanup guaranteed)

## Usage (draft)

```js
import { createFoundation, definePlugin } from '@foundation/core';

const disclosure = definePlugin({
  name: 'disclosure',
  selector: '[data-disclosure]',
  mount(element, { on, emit }) {
    on(element, 'click', () => emit(element, 'foundation:toggle'));
  }
});

const app = createFoundation({ plugins: [disclosure] });
app.init(document);
```

