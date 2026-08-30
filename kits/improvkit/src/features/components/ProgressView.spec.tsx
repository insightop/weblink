import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { I18nProvider } from '../i18n/react'
import { ProgressView } from './ProgressView'

afterEach(() => cleanup())

describe('ProgressView', () => {
  it('居中进度视图：status 语义容器 + 传入文案', () => {
    render(
      <I18nProvider locale="en-US">
        <ProgressView label="Provisioning…" />
      </I18nProvider>,
    )
    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.getByText('Provisioning…')).toBeTruthy()
  })
})
