import { ReactNode } from 'react'
import Header from './Header'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-[#ECE5DD] dark:bg-[#0D1117] transition-colors flex flex-col overflow-visible">
      <Header />
      <div className="flex flex-1 overflow-visible pt-14 min-w-0">
        <Sidebar />
        <main className="flex-1 min-h-[calc(100vh-56px)] pb-20 lg:pb-0 overflow-y-auto lg:ml-60 min-w-0">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
