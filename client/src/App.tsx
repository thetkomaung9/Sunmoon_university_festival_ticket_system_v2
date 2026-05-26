import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import AboutPage from "./pages/About";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminEventDetail from "./pages/admin/AdminEventDetail";
import AdminEvents from "./pages/admin/AdminEvents";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminReports from "./pages/admin/AdminReports";
import CategoriesPage from "./pages/Categories";
import CheckoutPage from "./pages/Checkout";
import EventDetailPage from "./pages/EventDetail";
import EventsPage from "./pages/Events";
import Home from "./pages/Home";
import ScannerPage from "./pages/Scanner";
import TicketViewPage from "./pages/TicketView";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/about" component={AboutPage} />
      <Route path="/categories" component={CategoriesPage} />
      <Route path="/categories/:slug" component={EventsPage} />
      <Route path="/events" component={EventsPage} />
      <Route path="/events/:slug" component={EventDetailPage} />
      <Route path="/checkout/:merchantUid" component={CheckoutPage} />
      <Route path="/ticket/:code" component={TicketViewPage} />
      <Route path="/scanner" component={ScannerPage} />
      <Route path="/admin" component={AdminOverview} />
      <Route path="/admin/events" component={AdminEvents} />
      <Route path="/admin/events/:id" component={AdminEventDetail} />
      <Route path="/admin/categories" component={AdminCategories} />
      <Route path="/admin/orders" component={AdminOrders} />
      <Route path="/admin/reports" component={AdminReports} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
