import { create } from 'zustand'

interface ThemeState {
  isDark: boolean
  toggleTheme: () => void
  setDark: (dark: boolean) => void
}

const savedTheme = localStorage.getItem('vozzap-theme')
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
const initialDark = savedTheme ? savedTheme === 'dark' : prefersDark

const applyDarkClass = (enabled: boolean) => {
  if (enabled) {
    document.documentElement.classList.add('dark')
    document.body.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
    document.body.classList.remove('dark')
  }
}

if (initialDark) {
  applyDarkClass(true)
} else {
  applyDarkClass(false)
}

export const useThemeStore = create<ThemeState>((set) => ({
  isDark: initialDark,
  toggleTheme: () =>
    set((state) => {
      const newDark = !state.isDark
      applyDarkClass(newDark)
      localStorage.setItem('vozzap-theme', newDark ? 'dark' : 'light')
      return { isDark: newDark }
    }),
  setDark: (dark) => {
    applyDarkClass(dark)
    localStorage.setItem('vozzap-theme', dark ? 'dark' : 'light')
    set({ isDark: dark })
  },
}))
