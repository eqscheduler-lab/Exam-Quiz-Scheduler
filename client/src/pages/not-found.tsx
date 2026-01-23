import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <h1 className="text-2xl font-bold">Page Not Found</h1>
          </div>

          <p className="mt-4 text-muted-foreground">
            The page you are looking for doesn't exist or you don't have permission to view it.
          </p>
          
          <div className="mt-8">
             <Link href="/">
               <Button className="w-full">Return to Dashboard</Button>
             </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
