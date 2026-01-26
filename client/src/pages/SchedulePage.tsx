import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfWeek, addDays, getDay } from "date-fns";
import { Download, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { api } from "@shared/routes";
import { useAuth } from "@/hooks/use-auth";
import { useExams } from "@/hooks/use-exams";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExamDialog } from "@/components/ExamDialog";
import { type Class, BELL_SCHEDULES, getGradeLevel } from "@shared/schema";
import { cn } from "@/lib/utils";

// --- Types ---
type Period = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
type DayName = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday";

const DAYS: DayName[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const PERIODS: Period[] = [1, 2, 3, 4, 5, 6, 7, 8];

// --- Helpers ---
function getDateForDay(startOfWeekDate: Date, dayIndex: number): Date {
  return addDays(startOfWeekDate, dayIndex);
}

export default function SchedulePage() {
  const { user } = useAuth();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });

  const [selectedClassId, setSelectedClassId] = useState<string>("all");

  const { data: classes } = useQuery<Class[]>({
    queryKey: ["/api/classes"],
  });

  const selectedClass = classes?.find(c => c.id.toString() === selectedClassId);
  const gradeLevel = selectedClass ? getGradeLevel(selectedClass.name) : "G9_10";

  const isTeacher = user?.role === "TEACHER";
  
  const { data: exams, isLoading } = useExams({
    weekStart: weekStart.toISOString(),
    classId: selectedClassId !== "all" ? Number(selectedClassId) : undefined,
    teacherId: isTeacher ? user?.id : undefined,
  });

  const handleExportPDF = async () => {
    const params = new URLSearchParams({
        weekStart: weekStart.toISOString(),
    });
    if (selectedClassId !== "all") {
      params.append("classId", selectedClassId);
    }
    window.open(`${api.schedule.pdf.path}?${params.toString()}`, '_blank');
  };

  const nextWeek = () => setCurrentDate(addDays(currentDate, 7));
  const prevWeek = () => setCurrentDate(addDays(currentDate, -7));

  const renderCell = (day: DayName, period: Period) => {
    const dayIndex = DAYS.indexOf(day) + 1;
    const cellDate = getDateForDay(weekStart, dayIndex - 1);
    
    if (day === "Friday" && period > 4) {
      return <div className="bg-slate-50 dark:bg-slate-900/50 h-full w-full diagonal-stripe" />;
    }

    const cellExams = exams?.filter(e => {
      const d = new Date(e.date);
      return d.getDate() === cellDate.getDate() && 
             d.getMonth() === cellDate.getMonth() && 
             e.period === period;
    });

    const hasExam = cellExams && cellExams.length > 0;

    return (
      <div className="h-full min-h-[100px] p-1 relative group">
        {hasExam ? (
          <div className="flex flex-col gap-1 h-full">
            {cellExams.map((exam) => (
              <ExamDialog 
                key={exam.id} 
                mode="edit" 
                examId={exam.id}
                defaultValues={exam}
                trigger={
                  <button className={cn(
                    "w-full text-left p-2 rounded-md text-xs border transition-all hover:scale-[1.02]",
                    exam.type === 'EXAM' 
                      ? "bg-purple-100 border-purple-200 text-purple-900 hover:bg-purple-200 dark:bg-purple-900/30 dark:border-purple-800 dark:text-purple-100" 
                      : "bg-amber-100 border-amber-200 text-amber-900 hover:bg-amber-200 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-100"
                  )}>
                    <div className="font-bold truncate">{exam.subject.code}</div>
                    <div className="truncate opacity-80">{exam.class.name}</div>
                    <div className="truncate opacity-80">{exam.type}</div>
                  </button>
                }
              />
            ))}
          </div>
        ) : (
          <div className="h-full w-full opacity-0 group-hover:opacity-100 transition-opacity">
             <ExamDialog 
               initialDate={cellDate}
               initialPeriod={period}
               initialClassId={selectedClassId !== "all" ? Number(selectedClassId) : undefined}
               trigger={
                 <button className="w-full h-full border-2 border-dashed border-primary/20 rounded-lg flex items-center justify-center text-primary/40 hover:text-primary hover:bg-primary/5 hover:border-primary transition-all">
                   <span className="text-sm font-medium">+ Add</span>
                 </button>
               }
             />
          </div>
        )}
      </div>
    );
  };

  return (
    <Layout title="Master Schedule">
      <div className="flex flex-col space-y-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-card p-4 rounded-xl border border-border shadow-sm">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={prevWeek}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="font-medium min-w-[200px] text-center">
              {format(weekStart, "MMM d")} - {format(addDays(weekStart, 4), "MMM d, yyyy")}
            </div>
            <Button variant="outline" size="icon" onClick={nextWeek}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
             <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg border border-border">
               <Filter className="w-4 h-4 text-muted-foreground" />
               <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                 <SelectTrigger className="w-[180px] h-8 border-none bg-transparent focus:ring-0">
                   <SelectValue placeholder="All Classes" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="all">All Classes</SelectItem>
                   {classes?.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                 </SelectContent>
               </Select>
             </div>
             
             <Button onClick={handleExportPDF} variant="outline" className="gap-2">
               <Download className="w-4 h-4" />
               <span className="hidden sm:inline">Export PDF</span>
             </Button>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[1000px]">
              {/* Header Row: Periods */}
              <div className="grid grid-cols-[150px_repeat(8,1fr)] bg-muted/50 border-b border-border">
                <div className="p-4 font-semibold text-sm text-muted-foreground border-r border-border flex items-center justify-center text-center leading-tight">
                  Day / Period
                </div>
                {PERIODS.map((period) => (
                  <div key={period} className="p-4 text-center border-r border-border last:border-r-0 flex flex-col items-center justify-center">
                    <div className="font-bold text-foreground">P{period}</div>
                    <div className="text-[10px] text-muted-foreground">
                       Dubai Time
                    </div>
                  </div>
                ))}
              </div>

              {/* Body: Days */}
              <div className="divide-y divide-border">
                {DAYS.map((day, i) => {
                  const isFri = day === "Friday";
                  const schedule = isFri ? BELL_SCHEDULES[gradeLevel].FRI : BELL_SCHEDULES[gradeLevel].MON_THU;
                  
                  return (
                    <div key={day} className="grid grid-cols-[150px_repeat(8,1fr)]">
                      <div className="p-4 border-r border-border flex flex-col items-center justify-center bg-muted/10">
                        <span className="font-bold text-foreground">{day}</span>
                        <span className="text-xs text-muted-foreground">{format(getDateForDay(weekStart, i), "MMM d")}</span>
                      </div>
                      {PERIODS.map((period) => {
                        const timeRange = schedule[period as keyof typeof schedule];
                        return (
                          <div key={`${day}-${period}`} className="border-r border-border last:border-r-0 min-h-[120px] relative">
                            {timeRange && (
                              <div className="absolute top-0 right-1 text-[9px] text-muted-foreground/60 font-mono">
                                {timeRange}
                              </div>
                            )}
                            {renderCell(day, period)}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
