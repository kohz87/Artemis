import { describe, expect, it } from 'vitest'
import {
  FileText,
  Flask,
  Hammer,
  Wrench,
} from '@phosphor-icons/react'
import { getTypeIcon } from './typeIcon'

describe('getTypeIcon', () => {
  it('resolves canonical and lowercase built-in type names consistently', () => {
    expect(getTypeIcon('Project')).toBe(Wrench)
    expect(getTypeIcon('project')).toBe(Wrench)
    expect(getTypeIcon('Experiment')).toBe(Flask)
    expect(getTypeIcon('experiment')).toBe(Flask)
  })

  it('prefers custom icons and falls back for unknown types', () => {
    expect(getTypeIcon('Project', 'hammer')).toBe(Hammer)
    expect(getTypeIcon('Unknown')).toBe(FileText)
    expect(getTypeIcon(null)).toBe(FileText)
  })
})
