import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/home";
import Retrieve from "@/pages/retrieve";
import HowItWorks from "@/pages/how-it-works";
import Terms from "@/pages/terms";
import Privacy from "@/pages/privacy";
import About from "@/pages/about";
import Compare from "@/pages/compare";
import Professionals from "@/pages/professionals";
import Blog from "@/pages/blog";
import BlogPost from "@/pages/blog-post";
import Admin from "@/pages/admin";
import WidgetDemo from "@/pages/widget-demo";
import TrustCenter from "@/pages/trust-center";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/d/:id" component={Retrieve} />
      <Route path="/how-it-works" component={HowItWorks} />
      <Route path="/terms" component={Terms} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/about" component={About} />
      <Route path="/compare" component={Compare} />
      <Route path="/professionals" component={Professionals} />
      <Route path="/blog" component={Blog} />
      <Route path="/blog/:slug" component={BlogPost} />
      <Route path="/admin" component={Admin} />
      <Route path="/widget-demo" component={WidgetDemo} />
      <Route path="/trust" component={TrustCenter} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
