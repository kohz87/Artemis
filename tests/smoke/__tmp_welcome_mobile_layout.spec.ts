import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 375, height: 667 } })

test('vault-missing welcome shell fits narrow viewport', async ({ page }) => {
  await page.goto('http://127.0.0.1:5201', { waitUntil: 'domcontentloaded' })

  const screen = page.getByTestId('welcome-screen')
  await expect(screen).toBeVisible()

  const box = await screen.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.y).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(375)
  expect(box!.y + box!.height).toBeLessThanOrEqual(667)

  for (const testId of ['welcome-create-vault', 'welcome-create-new', 'welcome-open-folder']) {
    const button = page.getByTestId(testId)
    await expect(button).toBeVisible()
    const buttonBox = await button.boundingBox()
    expect(buttonBox).not.toBeNull()
    expect(buttonBox!.x).toBeGreaterThanOrEqual(0)
    expect(buttonBox!.y).toBeGreaterThanOrEqual(0)
    expect(buttonBox!.x + buttonBox!.width).toBeLessThanOrEqual(375)
    expect(buttonBox!.y + buttonBox!.height).toBeLessThanOrEqual(667)
  }
})
