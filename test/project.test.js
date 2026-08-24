import test from 'node:test'
import assert from 'node:assert/strict'
import { describeProjectPath } from '../src/project.js'

test('describeProjectPath splits a filesystem path into name and parent', () => {
  const info = describeProjectPath('/Users/me/claudeWorkspace/ScriptPilot')
  assert.equal(info.label, 'ScriptPilot')
  assert.equal(info.parent, 'claudeWorkspace')
})

test('describeProjectPath disambiguates same-named projects by their parent', () => {
  const a = describeProjectPath('/Users/me/claudeWorkspace/ScriptPilot')
  const b = describeProjectPath('/Users/me/IdeaProjects/ScriptPilot')
  assert.equal(a.label, b.label)
  assert.notEqual(a.parent, b.parent)
})

test('describeProjectPath tolerates a bare name with no parent', () => {
  const info = describeProjectPath('ScriptPilot')
  assert.equal(info.label, 'ScriptPilot')
  assert.equal(info.parent, '')
})

test('describeProjectPath handles a trailing slash', () => {
  assert.equal(describeProjectPath('/Users/me/app/').label, 'app')
})

test('describeProjectPath falls back to a placeholder for an empty path', () => {
  assert.equal(describeProjectPath('').label, '알 수 없음')
})
