import test from 'node:test'
import assert from 'node:assert/strict'
import { buildClientScript } from '../src/render/bundle.js'

test('buildClientScript strips module syntax so the code can be inlined', async () => {
  const script = await buildClientScript()
  assert.ok(!/^\s*export\s/m.test(script), 'no export statements should remain')
  assert.ok(!/^\s*import\s/m.test(script), 'no import statements should remain')
})

test('buildClientScript includes both the formatters and the renderer', async () => {
  const script = await buildClientScript()
  assert.match(script, /function formatCost/)
  assert.match(script, /function renderGauge/)
})
