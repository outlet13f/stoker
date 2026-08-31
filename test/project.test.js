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

test('describeProjectPath splits a Windows drive path on backslashes', () => {
  const info = describeProjectPath('C:\\Users\\me\\claudeWorkspace\\ScriptPilot')
  assert.equal(info.label, 'ScriptPilot')
  assert.equal(info.parent, 'claudeWorkspace')
})

test('describeProjectPath splits a Windows UNC path', () => {
  const info = describeProjectPath('\\\\build-server\\share\\ScriptPilot')
  assert.equal(info.label, 'ScriptPilot')
  assert.equal(info.parent, 'share')
})

test('describeProjectPath handles a Windows path with a trailing separator', () => {
  assert.equal(describeProjectPath('C:\\Users\\me\\app\\').label, 'app')
})

test('describeProjectPath keeps a backslash inside a POSIX directory name', () => {
  // POSIX 에서 역슬래시는 정상적인 파일명 글자다. 경로 구분자로 보면 이름이 쪼개진다.
  const info = describeProjectPath('/Users/me/we\\ird')
  assert.equal(info.label, 'we\\ird')
  assert.equal(info.parent, 'me')
})
