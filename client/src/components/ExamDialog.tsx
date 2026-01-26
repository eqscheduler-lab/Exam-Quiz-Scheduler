import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, isSameDay } from "date-fns";
import { CalendarIcon, Loader2, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

import { useCreateExam, useUpdateExam, useExams } from "@/hooks/use-exams";
import { useSubjects } from "@/hooks/use-subjects";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { examTypes, insertExamEventSchema, type Class } from "@shared/schema";

// Form Schema
const formSchema = insertExamEventSchema.extend({
  date: z.date({ required_error: "A date is required." }),
  period: z.coerce.number().min(1).max(8),
  classId: z.coerce.number().min(1),
  subjectId: z.coerce.number(),
});

type ExamFormValues = z.infer<typeof formSchema>;

interface ExamDialogProps {
  trigger?: React.ReactNode;
  initialDate?: Date;
  initialPeriod?: number;
  initialClassId?: number;
  mode?: "create" | "edit";
  examId?: number;
  defaultValues?: Partial<ExamFormValues>;
}

export function ExamDialog({ 
  trigger, 
  initialDate, 
  initialPeriod, 
  initialClassId,
  mode = "create",
  examId,
  defaultValues
}: ExamDialogProps) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const createExam = useCreateExam();
  const updateExam = useUpdateExam();
  const { data: subjects } = useSubjects();
  const { data: classes } = useQuery<Class[]>({ queryKey: ["/api/classes"] });
  
  // Convert date string to Date object if needed
  const parseDate = (date: any): Date => {
    if (!date) return new Date();
    if (date instanceof Date) return date;
    return new Date(date);
  };

  const form = useForm<ExamFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: defaultValues?.title || "",
      type: defaultValues?.type || "HOMEWORK",
      date: parseDate(initialDate || defaultValues?.date),
      period: initialPeriod || defaultValues?.period || 1,
      classId: initialClassId || defaultValues?.classId || undefined,
      subjectId: defaultValues?.subjectId || undefined,
      status: "SCHEDULED",
      notes: defaultValues?.notes || "",
      createdByUserId: user?.id,
    },
  });

  // Reset form when dialog opens with new values (for edit mode)
  useEffect(() => {
    if (open && mode === "edit" && defaultValues) {
      form.reset({
        title: defaultValues.title || "",
        type: defaultValues.type || "HOMEWORK",
        date: parseDate(defaultValues.date),
        period: defaultValues.period || 1,
        classId: defaultValues.classId || undefined,
        subjectId: defaultValues.subjectId || undefined,
        status: "SCHEDULED",
        notes: defaultValues.notes || "",
        createdByUserId: user?.id,
      });
    }
  }, [open, mode, defaultValues, form, user?.id]);

  // Watch form values for quiz availability check
  const watchedDate = form.watch("date");
  const watchedClassId = form.watch("classId");
  const watchedType = form.watch("type");

  // Fetch existing exams for the selected date to check quiz limits
  const { data: existingExams } = useExams(
    watchedDate ? { weekStart: watchedDate.toISOString() } : undefined
  );

  // Check if a quiz already exists for this class on this day
  const quizAlreadyBooked = useMemo(() => {
    if (!existingExams || !watchedDate || !watchedClassId) return false;
    
    const selectedDate = parseDate(watchedDate);
    const existingQuizzes = existingExams.filter((exam: any) => {
      // Skip the current exam if we're editing
      if (mode === "edit" && exam.id === examId) return false;
      
      const examDate = new Date(exam.date);
      return (
        exam.type === "QUIZ" &&
        exam.classId === watchedClassId &&
        isSameDay(examDate, selectedDate) &&
        exam.status === "SCHEDULED"
      );
    });
    
    return existingQuizzes.length > 0;
  }, [existingExams, watchedDate, watchedClassId, mode, examId]);

  const onSubmit = async (data: ExamFormValues) => {
    try {
      if (mode === "create") {
        await createExam.mutateAsync({
          ...data,
          createdByUserId: user!.id,
        });
      } else if (mode === "edit" && examId) {
        await updateExam.mutateAsync({
          id: examId,
          ...data,
        });
      }
      setOpen(false);
      form.reset();
    } catch (error) {
      console.error(error);
    }
  };

  const isPending = createExam.isPending || updateExam.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button>Schedule Exam</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Schedule New Exam" : "Edit Exam Details"}</DialogTitle>
          <DialogDescription>
            {mode === "create" 
              ? "Book a slot for homework or quiz. Quizzes are limited to 1 per class per day." 
              : "Update exam details. Changes will notify relevant students."}
          </DialogDescription>
        </DialogHeader>

        {quizAlreadyBooked && watchedType === "QUIZ" && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>A quiz is already scheduled for this class on this day. Choose Homework instead or select a different date/class.</span>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Midterm Physics" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {examTypes.map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="subjectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject</FormLabel>
                    <Select 
                      onValueChange={(val) => field.onChange(Number(val))} 
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select subject" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {[...(subjects || [])].sort((a, b) => a.name.localeCompare(b.name)).map((subject) => (
                          <SelectItem key={subject.id} value={subject.id.toString()}>
                            {subject.name} ({subject.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="classId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Class</FormLabel>
                  <Select 
                    onValueChange={(val) => field.onChange(Number(val))} 
                    value={field.value?.toString()}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select class (e.g. A10 [AMT]/1)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {classes?.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id.toString()}>
                          {cls.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date < new Date(new Date().setHours(0, 0, 0, 0)) || // Past dates
                            date.getDay() === 0 || date.getDay() === 6 // Weekends
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="period"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Period</FormLabel>
                    <Select 
                      onValueChange={(val) => field.onChange(Number(val))} 
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select period" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((p) => (
                          <SelectItem key={p} value={p.toString()}>Period {p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Topics covered, allowed materials..." {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end pt-4">
              <Button 
                type="submit" 
                disabled={isPending || (quizAlreadyBooked && watchedType === "QUIZ")} 
                className="w-full sm:w-auto"
              >
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "create" ? "Schedule Exam" : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
