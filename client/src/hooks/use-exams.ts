import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type InsertExamEvent } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

type ExamFilters = {
  weekStart?: string;
  classProgram?: string;
  section?: number;
  teacherId?: number;
};

export function useExams(filters?: ExamFilters) {
  const queryKey = [api.exams.list.path, JSON.stringify(filters)];
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      const url = filters 
        ? `${api.exams.list.path}?${new URLSearchParams(Object.entries(filters).filter(([_, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))}`
        : api.exams.list.path;
      
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch exams");
      return api.exams.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateExam() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertExamEvent) => {
      // Validate data against input schema before sending
      const validated = api.exams.create.input.parse(data);
      
      const res = await fetch(api.exams.create.path, {
        method: api.exams.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 400) {
          const err = await res.json();
          throw new Error(err.message);
        }
        throw new Error("Failed to create exam");
      }
      
      return api.exams.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.exams.list.path] });
      toast({ title: "Success", description: "Exam scheduled successfully." });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateExam() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & Partial<InsertExamEvent>) => {
      const url = buildUrl(api.exams.update.path, { id });
      const validated = api.exams.update.input.parse(updates);

      const res = await fetch(url, {
        method: api.exams.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 400) {
           const err = await res.json();
           throw new Error(err.message);
        }
        throw new Error("Failed to update exam");
      }
      
      return api.exams.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.exams.list.path] });
      toast({ title: "Updated", description: "Exam updated successfully." });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
