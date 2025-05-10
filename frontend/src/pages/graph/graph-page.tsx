import React from "react";
import { documentsApi } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function GraphPage() {
  const graphImageUrl = documentsApi.getGraphImageUrl();

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>LangGraph Visualization</CardTitle>
          <CardDescription>
            This graph shows the flow and components of the document processing system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto border rounded-md p-4">
            <img
              src={graphImageUrl}
              alt="LangGraph Visualization"
              className="mx-auto"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 