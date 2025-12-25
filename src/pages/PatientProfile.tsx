import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "@/lib/firebase"; // SWITCHED TO FIREBASE
import { collection, doc, getDoc, getDocs, deleteDoc, query, where } from 'firebase/firestore'; // Firebase methods
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  User,
  Stethoscope,
  Calendar,
  FileText,
  Pill,
  Edit,
  Trash2,
  HeartPulse,
  BookOpen,
  Loader2,
  Brain
} from "lucide-react";

// --- TypeScript Interfaces (Updated for Firebase) ---
interface Medication { name: string; dosage: string; frequency: string; }
interface Appointment { date: string; time: string; type: string; clinician: string; }
interface Patient { id: string; name: string; age: number; gender: string; mrn: string; last_visit: string; primary_care: string; conditions: string[]; weight: number | null; height: number | null; diabetes_duration: number | null; diabetes_type: string | null; medical_history: string | null; family_history: string | null; frailty_score: number | null; mobility_assessment: string | null; adl_assessment: string | null; cognitive_status: string | null; social_support: string | null; vitals: any; medications: Medication[]; appointments: Appointment[]; }
interface PatientListItem { id: string; name: string; }

export default function PatientProfile() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [patient, setPatient] = useState<Patient | null>(null);
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  useEffect(() => {
    const initializePage = async () => {
      setLoading(true);
      setError(null);

      try {
        // Step 1: Fetch the list of all patients for the dropdown.
        const patientsCollection = collection(db, 'patients');
        const patientListSnapshot = await getDocs(patientsCollection);
        const patientList = patientListSnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name as string }));
        setPatients(patientList.sort((a,b) => a.name.localeCompare(b.name)));

        // Step 2: If a patientId is in the URL, fetch their full profile.
        if (patientId) {
          const patientDocRef = doc(db, 'patients', patientId);
          const patientDoc = await getDoc(patientDocRef);

          if (!patientDoc.exists()) {
            setError(`Error: Patient with ID ${patientId} not found.`);
            setPatient(null);
            toast({ title: "Patient Not Found", variant: "destructive" });
          } else {
            const patientData = patientDoc.data();
            
            const vitalsDocRef = doc(db, 'vitals', patientId); // Assumes vitals ID = patient ID
            const vitalsDoc = await getDoc(vitalsDocRef);
            const vitalsData = vitalsDoc.exists() ? vitalsDoc.data() : {};

            const medsQuery = query(collection(db, "medications"), where("patient_id", "==", patientId));
            const medsSnapshot = await getDocs(medsQuery);
            const medicationsData = medsSnapshot.docs.map(d => d.data()) as Medication[];
            
            setPatient({ 
              id: patientDoc.id, 
              ...(patientData as Omit<Patient, 'id' | 'vitals' | 'medications' | 'appointments'>),
              vitals: vitalsData,
              medications: medicationsData,
              appointments: [] // Placeholder for appointments
            });
          }
        } else {
          setPatient(null); // Clear patient if no ID in URL
        }

      } catch (e) {
          console.error("Error initializing page: ", e);
          setError("Error: Could not load required data from the database.");
          toast({ title: "Database Error", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    initializePage();
  }, [patientId, toast]); // Re-run when patientId changes


  const handlePatientChange = (id: string) => {
    if (id !== patientId) {
      navigate(`/patient-profile/${id}`);
    }
  };

  const handleDeletePatient = async () => {
    if (!patient) return;
    try {
      await deleteDoc(doc(db, 'patients', patient.id));
      await deleteDoc(doc(db, 'vitals', patient.id)); // Also delete associated vitals

      toast({ title: "Patient Deleted", description: `${patient.name} has been removed.` });
      navigate('/patient-profile', { replace: true });
    } catch (error) {
      console.error("Delete Error:", error);
      toast({ title: "Error Deleting Patient", description: "Could not remove patient data.", variant: "destructive" });
    }
    setIsDeleteDialogOpen(false);
  };


  // --- RENDER LOGIC --- //

  const renderInfoCard = (title: string, data: { [key: string]: any }, Icon: React.ElementType) => {
    const entries = Object.entries(data).filter(([_, value]) => value != null && value !== '' && value !== 'N/A');
    if (entries.length === 0) return null;
    return (
      <Card className="shadow-card"><CardHeader><CardTitle className="flex items-center"><Icon className="w-5 h-5 mr-2 text-primary" />{title}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {entries.map(([key, value]) => (
            <div key={key} className="flex justify-between items-start">
              <p className="text-sm font-medium text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</p>
              <p className="text-sm font-semibold text-right">{String(value)}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  };

  const renderTextBlockCard = (title: string, text: string | null | undefined, Icon: React.ElementType) => {
    if (!text) return null;
    return (
      <Card className="shadow-card">
        <CardHeader><CardTitle className="flex items-center"><Icon className="w-5 h-5 mr-2 text-primary" />{title}</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-foreground whitespace-pre-wrap">{text}</p></CardContent>
      </Card>
    );
  };
  
  if (loading) {
    return <DashboardLayout><div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-primary" /><p className="text-xl ml-4">Loading Patient Data...</p></div></DashboardLayout>;
  }

  if (!patient) {
    if (patients && patients.length > 0) {
        return <DashboardLayout><div className="flex flex-col gap-4 items-center justify-center h-full">
            <h2 className="text-2xl font-bold">Select a Patient</h2>
            <p className="text-sm text-center text-muted-foreground max-w-md">To get started, load the first patient's profile and then choose the patient of your choice from the dropdown.</p>
            <Button onClick={() => navigate(`/patient-profile/${patients[0].id}`)}>Load First Patient Profile</Button>
        </div></DashboardLayout>;
    }

    return <DashboardLayout><div className="flex flex-col gap-4 items-center justify-center h-full">
        <p className="text-xl font-semibold text-muted-foreground">No Patient Data</p>
        <p className="text-sm text-center max-w-md">{error ? error : "There are no patients in the database. Please add a new patient to begin."}</p>
        <Button onClick={() => navigate('/patient-data')}>Add a New Patient</Button>
    </div></DashboardLayout>;
  }

  const bmi = patient.weight && patient.height ? (patient.weight / ((patient.height / 100) ** 2)).toFixed(2) : null;

  return (
    <DashboardLayout>
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete <strong>{patient.name}</strong> and all associated data.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeletePatient} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>

      <div className="space-y-6">
        <div className="flex justify-between items-center">
           <Select onValueChange={handlePatientChange} value={patientId}><SelectTrigger className="w-full max-w-xs"><SelectValue placeholder="Select a patient" /></SelectTrigger>
             <SelectContent>{patients.map(p => (<SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>))}</SelectContent>
           </Select>
           <div className="flex space-x-2">
              <Button variant="outline" onClick={() => navigate(`/risk-assessment/${patientId}`)}><Brain className="mr-2 h-4 w-4"/>Risk Assessment</Button>
              <Button variant="outline" onClick={() => navigate(`/patient-data/${patientId}`)}><Edit className="mr-2 h-4 w-4"/>Edit</Button>
              <Button variant="destructive" onClick={() => setIsDeleteDialogOpen(true)}><Trash2 className="mr-2 h-4 w-4"/>Delete</Button>
            </div>
        </div>

        <Card className="shadow-card">
          <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            <div className="flex items-center space-x-4">
              <div className="bg-primary text-primary-foreground rounded-full w-16 h-16 flex items-center justify-center"><User className="w-8 h-8" /></div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">{patient.name}</h1>
                <p className="text-sm md:text-base text-muted-foreground">{patient.age} y/o {patient.gender} | MRN: {patient.mrn}</p>
              </div>
            </div>
             <div className="text-sm text-muted-foreground text-left md:text-right">
              <p>Last Visit: {new Date(patient.last_visit).toLocaleDateString()}</p>
              <p>Primary Care: {patient.primary_care || 'N/A'}</p>
            </div>
          </CardHeader>
           <CardContent>
             <div className="flex flex-wrap gap-2 items-center">
                <strong className="text-sm text-muted-foreground">Conditions:</strong>
                {patient.conditions?.length > 0 ? patient.conditions.map(c => (<Badge key={c} variant="secondary">{c}</Badge>)) : <p className="text-sm">None listed</p>}
              </div>
          </CardContent>
        </Card>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {renderInfoCard('Vitals & Labs', { 'Blood Pressure': patient.vitals?.bp, 'Heart Rate': patient.vitals?.hr, 'Temperature': patient.vitals?.temp, 'Fasting Glucose': patient.vitals?.glucose, 'HbA1c': patient.vitals?.hba1c ? `${patient.vitals.hba1c}%` : null, 'Creatinine': patient.vitals?.creatinine ? `${patient.vitals.creatinine} mg/dL` : null, 'eGFR': patient.vitals?.egfr ? `${patient.vitals.egfr} ml/min/1.73m²` : null }, Stethoscope)}
            {renderInfoCard('Clinical Stats', { 'Weight': patient.weight ? `${patient.weight} kg` : null, 'Height': patient.height ? `${patient.height} cm` : null, 'BMI': bmi, 'Diabetes Type': patient.diabetes_type, 'Diabetes Duration': patient.diabetes_duration ? `${patient.diabetes_duration} years` : null, }, HeartPulse)}
            {renderInfoCard('Functional Status', { 'Frailty Score': patient.frailty_score, 'Mobility': patient.mobility_assessment, 'Cognitive Status': patient.cognitive_status }, FileText)}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {renderTextBlockCard('Medical History', patient.medical_history, BookOpen)}
          {renderTextBlockCard('Family History', patient.family_history, BookOpen)}
          {renderTextBlockCard('ADL Assessment', patient.adl_assessment, FileText)}
          {renderTextBlockCard('Social Support', patient.social_support, FileText)}
        </div>

        <Card className="shadow-card">
          <CardHeader><CardTitle className="flex items-center"><Pill className="w-5 h-5 mr-2 text-primary" />Current Medications</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Medication</TableHead><TableHead>Dosage</TableHead><TableHead>Frequency</TableHead></TableRow></TableHeader>
              <TableBody>
                {patient.medications?.length > 0 ? patient.medications.map((med, i) => (
                  <TableRow key={i}><TableCell className="font-medium">{med.name}</TableCell><TableCell>{med.dosage}</TableCell><TableCell>{med.frequency}</TableCell></TableRow>
                )) : <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No medications listed.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

      </div>
    </DashboardLayout>
  );
}
