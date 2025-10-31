import './App.css'
import Pages from "@/pages/index.jsx"
import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"

function App() {
  return (
    <>
      <Pages />
      <Toaster />
      <SonnerToaster />
    </>
  )
}

export default App 