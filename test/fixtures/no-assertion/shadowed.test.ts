// This file defines its own `it`. We cannot know what it does, so none of these calls are treated as tests.
import { add } from './math';

const it = (label: string, run: () => void) => {
  console.log(label);
  run();
};

it('runs a scenario', () => {
  add(1, 2);
});
