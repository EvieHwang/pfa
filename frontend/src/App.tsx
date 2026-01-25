import { Routes, Route, NavLink, Navigate } from "react-router-dom"
import { ThemeToggle } from "./components/ThemeToggle"
import { ReviewBadge } from "./components/ReviewBadge"
import { ReviewQueue } from "./pages/ReviewQueue"
import { RulesManager } from "./pages/Settings/RulesManager"
import { cn } from "@/lib/utils"
import { LayoutDashboard, ListTodo, Settings, Upload } from "lucide-react"

// Placeholder pages (to be implemented)
function Dashboard() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="text-muted-foreground">
        Dashboard view coming soon. For now, use the Review queue to categorize transactions.
      </p>
    </div>
  )
}

function Transactions() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Transactions</h1>
      <p className="text-muted-foreground">
        Transaction list coming soon. Use the Upload button to add transactions.
      </p>
    </div>
  )
}

function SettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Settings</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <NavLink
          to="/settings/rules"
          className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
        >
          <h3 className="font-semibold">Categorization Rules</h3>
          <p className="text-sm text-muted-foreground">
            Manage auto-categorization rules for transactions
          </p>
        </NavLink>
      </div>
    </div>
  )
}

function NavItem({
  to,
  children,
  icon: Icon,
  badge,
}: {
  to: string
  children: React.ReactNode
  icon: React.ComponentType<{ className?: string }>
  badge?: React.ReactNode
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
          isActive
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        )
      }
    >
      <Icon className="h-4 w-4" />
      {children}
      {badge}
    </NavLink>
  )
}

function App() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <NavLink to="/" className="text-lg font-bold">
              PFA
            </NavLink>
            <nav className="hidden md:flex items-center gap-1">
              <NavItem to="/" icon={LayoutDashboard}>
                Dashboard
              </NavItem>
              <NavItem to="/transactions" icon={Upload}>
                Transactions
              </NavItem>
              <NavItem to="/review" icon={ListTodo} badge={<ReviewBadge />}>
                Review
              </NavItem>
              <NavItem to="/settings" icon={Settings}>
                Settings
              </NavItem>
            </nav>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Mobile Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex justify-around py-2">
          <NavLink
            to="/"
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-1 px-3 py-1 text-xs",
                isActive ? "text-primary" : "text-muted-foreground"
              )
            }
          >
            <LayoutDashboard className="h-5 w-5" />
            Dashboard
          </NavLink>
          <NavLink
            to="/transactions"
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-1 px-3 py-1 text-xs",
                isActive ? "text-primary" : "text-muted-foreground"
              )
            }
          >
            <Upload className="h-5 w-5" />
            Transactions
          </NavLink>
          <NavLink
            to="/review"
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-1 px-3 py-1 text-xs relative",
                isActive ? "text-primary" : "text-muted-foreground"
              )
            }
          >
            <ListTodo className="h-5 w-5" />
            Review
            <span className="absolute -top-1 -right-1">
              <ReviewBadge className="scale-75" />
            </span>
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-1 px-3 py-1 text-xs",
                isActive ? "text-primary" : "text-muted-foreground"
              )
            }
          >
            <Settings className="h-5 w-5" />
            Settings
          </NavLink>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 pb-20 md:pb-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/review" element={<ReviewQueue />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/rules" element={<RulesManager />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
