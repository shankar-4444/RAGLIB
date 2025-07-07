import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useLibraryStore } from "@/store/libraryStore";
import {
  Settings as SettingsIcon,
  Key,
  Database,
  Zap,
  RefreshCw,
  Trash2,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

export const Settings = () => {
  const { libraries, fetchLibraries } = useLibraryStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [vectorStoreStats, setVectorStoreStats] = useState<any>(null);
  const [backendStatus, setBackendStatus] = useState<
    "connected" | "disconnected" | "checking"
  >("checking");
  const { toast } = useToast();

  // Performance settings
  const [chunkSize, setChunkSize] = useState(1000);
  const [chunkOverlap, setChunkOverlap] = useState(200);
  const [maxResults, setMaxResults] = useState(5);
  const [batchSize, setBatchSize] = useState(20);
  const [minRelevant, setMinRelevant] = useState(5);
  const [maxBatches, setMaxBatches] = useState(25);

  // Check backend status
  useEffect(() => {
    checkBackendStatus();
    fetchVectorStoreStats();
  }, []);

  const checkBackendStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/health`);
      if (response.ok) {
        const data = await response.json();
        setVectorStoreStats(data.vector_store);
        setBackendStatus("connected");
      } else {
        setBackendStatus("disconnected");
      }
    } catch (error) {
      setBackendStatus("disconnected");
    }
  };

  const fetchVectorStoreStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/libraries/vector-store/stats`);
      if (response.ok) {
        const stats = await response.json();
        setVectorStoreStats(stats);
      }
    } catch (error) {
      console.error("Failed to fetch vector store stats:", error);
    }
  };

  const handleRebuildIndex = async () => {
    setIsRebuilding(true);
    try {
      const response = await fetch(`${API_BASE}/libraries/rebuild-index`, {
        method: "POST",
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: "Index Rebuilt",
          description: `Successfully rebuilt index with ${result.stats.total_embeddings} embeddings`,
        });
        await fetchVectorStoreStats();
      } else {
        throw new Error("Failed to rebuild index");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to rebuild vector index",
        variant: "destructive",
      });
    } finally {
      setIsRebuilding(false);
    }
  };

  const handleClearAllData = async () => {
    if (
      !confirm(
        "Are you sure you want to clear all data? This will delete all libraries, documents, and conversations. This action cannot be undone."
      )
    ) {
      return;
    }

    setIsLoading(true);
    try {
      // Clear frontend state
      localStorage.clear();

      // Clear backend data by deleting all libraries
      for (const library of libraries) {
        await fetch(`${API_BASE}/libraries/${library.id}`, {
          method: "DELETE",
        });
      }

      // Rebuild empty index
      await handleRebuildIndex();

      // Refresh libraries
      await fetchLibraries();

      toast({
        title: "Data Cleared",
        description: "All data has been successfully cleared",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to clear all data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportData = () => {
    const data = {
      libraries: libraries,
      settings: {
        chunkSize,
        chunkOverlap,
        maxResults,
        batchSize,
        minRelevant,
        maxBatches,
      },
      timestamp: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rag-library-backup-${
      new Date().toISOString().split("T")[0]
    }.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Data Exported",
      description: "Your data has been exported successfully",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <SettingsIcon className="h-6 w-6" />
        <h2 className="text-2xl font-semibold">Settings</h2>
      </div>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CheckCircle
              className={`h-5 w-5 ${
                backendStatus === "connected"
                  ? "text-green-500"
                  : "text-red-500"
              }`}
            />
            <span>System Status</span>
          </CardTitle>
          <CardDescription>
            Current system status and vector store information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  backendStatus === "connected" ? "bg-green-500" : "bg-red-500"
                }`}
              />
              <span className="font-medium">
                Backend Status:{" "}
                {backendStatus === "connected" ? "Connected" : "Disconnected"}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={checkBackendStatus}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {vectorStoreStats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-3 bg-muted rounded-lg">
                <p className="text-2xl font-bold">
                  {vectorStoreStats.total_embeddings || 0}
                </p>
                <p className="text-sm text-muted-foreground">
                  Total Embeddings
                </p>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <p className="text-2xl font-bold">
                  {vectorStoreStats.index_size || 0}
                </p>
                <p className="text-sm text-muted-foreground">Index Size</p>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <p className="text-2xl font-bold">
                  {vectorStoreStats.dimension || 384}
                </p>
                <p className="text-sm text-muted-foreground">Dimensions</p>
              </div>
            </div>
          )}

          <div className="flex space-x-2">
            <Button
              onClick={handleRebuildIndex}
              disabled={isRebuilding || backendStatus !== "connected"}
              variant="outline"
            >
              {isRebuilding ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Rebuilding...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Rebuild Vector Index
                </>
              )}
            </Button>
            <Button
              onClick={fetchVectorStoreStats}
              disabled={backendStatus !== "connected"}
              variant="outline"
            >
              Refresh Stats
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Performance Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Zap className="h-5 w-5" />
            <span>Performance Settings</span>
          </CardTitle>
          <CardDescription>
            Adjust settings to optimize RAG performance and retrieval
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="chunk-size">Chunk Size (characters)</Label>
              <Input
                id="chunk-size"
                type="number"
                value={chunkSize}
                onChange={(e) => setChunkSize(Number(e.target.value))}
                min="100"
                max="2000"
                className="mt-1"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Number of characters per document chunk
              </p>
            </div>

            <div>
              <Label htmlFor="chunk-overlap">Chunk Overlap (characters)</Label>
              <Input
                id="chunk-overlap"
                type="number"
                value={chunkOverlap}
                onChange={(e) => setChunkOverlap(Number(e.target.value))}
                min="0"
                max="500"
                className="mt-1"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Overlap between consecutive chunks
              </p>
            </div>

            <div>
              <Label htmlFor="max-results">Max Results</Label>
              <Input
                id="max-results"
                type="number"
                value={maxResults}
                onChange={(e) => setMaxResults(Number(e.target.value))}
                min="1"
                max="20"
                className="mt-1"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Maximum chunks to retrieve per query
              </p>
            </div>

            <div>
              <Label htmlFor="batch-size">Batch Size</Label>
              <Input
                id="batch-size"
                type="number"
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value))}
                min="5"
                max="50"
                className="mt-1"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Chunks retrieved per batch
              </p>
            </div>

            <div>
              <Label htmlFor="min-relevant">Min Relevant Chunks</Label>
              <Input
                id="min-relevant"
                type="number"
                value={minRelevant}
                onChange={(e) => setMinRelevant(Number(e.target.value))}
                min="1"
                max="10"
                className="mt-1"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Minimum relevant chunks before stopping
              </p>
            </div>

            <div>
              <Label htmlFor="max-batches">Max Batches</Label>
              <Input
                id="max-batches"
                type="number"
                value={maxBatches}
                onChange={(e) => setMaxBatches(Number(e.target.value))}
                min="1"
                max="50"
                className="mt-1"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Maximum batches to search
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Database className="h-5 w-5" />
            <span>Data Management</span>
          </CardTitle>
          <CardDescription>
            Manage your libraries, documents, and system data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-3 bg-muted rounded-lg">
                <p className="text-2xl font-bold">{libraries.length}</p>
                <p className="text-sm text-muted-foreground">Libraries</p>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <p className="text-2xl font-bold">
                  {libraries.reduce(
                    (total, lib) => total + lib.documents.length,
                    0
                  )}
                </p>
                <p className="text-sm text-muted-foreground">Documents</p>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <p className="text-2xl font-bold">
                  {libraries.reduce(
                    (total, lib) =>
                      total +
                      lib.documents.reduce(
                        (docTotal, doc) => docTotal + (doc.chunks?.length || 0),
                        0
                      ),
                    0
                  )}
                </p>
                <p className="text-sm text-muted-foreground">Chunks</p>
              </div>
            </div>

            <Separator />

            <div className="flex space-x-2">
              <Button
                onClick={handleExportData}
                variant="outline"
                className="flex-1"
              >
                Export Data
              </Button>
              <Button
                variant="destructive"
                onClick={handleClearAllData}
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Clearing...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear All Data
                  </>
                )}
              </Button>
            </div>

            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    Data Storage
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    All data is stored locally in your browser and backend
                    database. Clearing data will permanently delete all
                    libraries, documents, and conversations.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
