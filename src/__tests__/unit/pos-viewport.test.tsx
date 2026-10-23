import { act, renderHook } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { usePOSViewport } from "@/hooks/use-pos-viewport"
afterEach(() => vi.unstubAllGlobals())
it("adapta os painéis à área visual reduzida pelo teclado e remove os ouvintes", () => {
  const viewport = Object.assign(new EventTarget(), { height: 800, offsetTop: 0 })
  vi.stubGlobal("visualViewport", viewport)
  const remove = vi.spyOn(viewport, "removeEventListener")
  const view = renderHook(() => usePOSViewport(true))
  expect(view.result.current).toMatchObject({ "--pos-viewport-height": "800px" })
  act(() => { viewport.height = 390; viewport.offsetTop = 12; viewport.dispatchEvent(new Event("resize")) })
  expect(view.result.current).toMatchObject({ "--pos-viewport-height": "390px", "--pos-viewport-top": "12px" })
  view.unmount()
  expect(remove).toHaveBeenCalledWith("resize", expect.any(Function))
  expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function))
})
it("não altera o enquadramento desktop", () => {
  const viewport = Object.assign(new EventTarget(), { height: 900, offsetTop: 0 })
  vi.stubGlobal("visualViewport", viewport)
  const add = vi.spyOn(viewport, "addEventListener")
  const { result } = renderHook(() => usePOSViewport(false))
  expect(result.current).toEqual({})
  expect(add).not.toHaveBeenCalled()
})
