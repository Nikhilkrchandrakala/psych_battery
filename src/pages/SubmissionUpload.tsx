import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { AssessmentSubmission, Assessment } from '../types';
import { useAuth } from '../components/AuthProvider';
import { Upload, FileText, CheckCircle2, AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

const SubmissionUpload: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile, mainSiteUrl } = useAuth();

  const [submission, setSubmission] = useState<AssessmentSubmission | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [piqFile, setPiqFile] = useState<File | null>(null);
  const [piqPreview, setPiqPreview] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string>("https://api.ssbwithisv.in/assets/Blank_PIQ_Form.pdf");

  useEffect(() => {
    const fetchPiqTemplate = async () => {
      try {
        const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
        const baseApiUrl = isLocal ? "http://localhost:5001/api" : "https://api.ssbwithisv.in/api";
        const response = await fetch(`${baseApiUrl}/allMagazinePdfs`);
        if (response.ok) {
          const magazines = await response.json();
          const piqDoc = magazines?.find((m: any) => 
            m?.pdfTitle?.toLowerCase().includes("personal information questionnaire") ||
            m?.pdfTitle?.toLowerCase().includes("piq")
          );
          if (piqDoc) {
            setDownloadUrl(isLocal ? `http://localhost:5001/${piqDoc.pdfFilePath}` : `https://api.ssbwithisv.in/${piqDoc.pdfFilePath}`);
          }
        }
      } catch (error) {
        console.error('Failed to fetch PIQ template URL:', error);
      }
    };

    fetchPiqTemplate();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        const subData = await api.submissions.get(id);
        setSubmission(subData);

        const assessData = await api.assessments.get(subData.assessmentId);
        setAssessment(assessData);
      } catch (error) {
        console.error('Failed to fetch submission for upload:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const handlePiqChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setPiqFile(file);
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => setPiqPreview(reader.result as string);
        reader.readAsDataURL(file);
      } else {
        setPiqPreview('PDF_ICON');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...newFiles]);
      
      // Generate previews
      newFiles.forEach((file: File) => {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onloadend = () => {
            setPreviews(prev => [...prev, reader.result as string]);
          };
          reader.readAsDataURL(file);
        } else {
          setPreviews(prev => [...prev, 'PDF_ICON']);
        }
      });
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!piqFile) {
      setError('PIQ Form is mandatory. Please upload your filled PIQ questionnaire first.');
      return;
    }
    if (files.length === 0) {
      setError('Please select at least one stimuli capture.');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Mock uploads
      const piqUrl = `https://via.placeholder.com/800x1200?text=PIQ+Form+${user?.uid?.slice(0, 5)}`;
      const answerUrls = files.map((_, i) => `https://via.placeholder.com/800x1200?text=Stimuli+Capture+${i + 1}`);
      
      // Update profile with PIQ if not already there
      if (user) {
        // Mock profile update
        console.log('Updating profile with PIQ URL:', piqUrl);
      }

      await api.submissions.update(id!, {
        status: 'UPLOADED',
        completedAt: new Date().toISOString(),
        uploadedFiles: [piqUrl, ...answerUrls]
      });

      navigate('/');
    } catch (error) {
      console.error('Failed to upload files:', error);
      setError('Failed to upload files. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (loading) return (
    <div className="flex justify-center items-center h-96">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-app-accent"></div>
    </div>
  );

  if (!submission || !assessment) return <div className="text-app-text-bright p-12 text-center">Submission data not found.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <div className="space-y-4">
        <button 
          onClick={() => window.location.href = `${mainSiteUrl}/ProfileDashboard?tab=psycheTest`}
          className="text-[10px] font-black text-app-text-muted hover:text-app-text-bright flex items-center gap-2 transition-colors uppercase tracking-[0.2em]"
        >
          <ArrowLeft size={14} /> Back to Profile
        </button>
        <div className="flex items-center gap-3">
           <h1 className="text-5xl font-black tracking-tighter text-app-text-bright">Dossier Upload</h1>
           <span className="px-3 py-1 bg-amber-500/10 text-amber-400 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] border border-amber-500/20">Pending Action</span>
        </div>
        <p className="text-app-text-muted text-xl font-serif italic max-w-2xl">
          Submit your handwritten responses for {assessment.title}. High-resolution images or PDF documents required.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          {/* PIQ Upload Slot - Priority */}
          <div className={cn(
            "bg-gradient-to-br border-2 border-dashed rounded-[2.5rem] p-8 flex flex-col items-center text-center transition-all relative overflow-hidden",
            !piqFile ? "from-amber-500/5 to-transparent border-amber-500/30" : "from-green-500/5 to-transparent border-green-500/30"
          )}>
            {!piqFile && (
              <div className="absolute top-6 right-6 px-3 py-1 bg-amber-500/10 text-amber-500 text-[9px] font-black uppercase tracking-widest border border-amber-500/20 rounded-full">
                Mandatory
              </div>
            )}
            
            <div className="flex items-center gap-4 mb-6">
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center border",
                !piqFile ? "bg-amber-500/10 border-amber-500/20 text-amber-500" : "bg-green-500/10 border-green-500/20 text-green-500"
              )}>
                <FileText size={20} />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-black text-app-text-bright">PIQ Form Submission</h3>
                <p className="text-[10px] font-black text-app-text-muted uppercase tracking-widest">Priority requirement</p>
              </div>
            </div>

            {piqFile ? (
              <div className="w-full bg-app-card border border-app-border rounded-2xl p-4 flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center">
                    <CheckCircle2 size={18} className="text-green-500" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-app-text-bright truncate max-w-[150px]">{piqFile.name}</p>
                    <p className="text-[9px] font-black text-app-text-muted uppercase italic">Form Received</p>
                  </div>
                </div>
                <button 
                  onClick={() => { setPiqFile(null); setPiqPreview(null); }}
                  className="text-[10px] font-black text-red-400 uppercase tracking-widest hover:text-red-300 transition-colors"
                >
                  Replace
                </button>
              </div>
            ) : (
              <div className="space-y-4 w-full">
                <input
                  type="file"
                  id="piq-upload"
                  className="hidden"
                  onChange={handlePiqChange}
                  accept="image/*,application/pdf"
                />
                <label 
                  htmlFor="piq-upload" 
                  className="flex flex-col items-center justify-center border border-app-border rounded-2xl p-8 hover:bg-white/5 cursor-pointer transition-all active:scale-[0.98] border-dashed"
                >
                  <Upload size={24} className="text-app-text-muted mb-2" />
                  <span className="text-xs font-bold text-app-text-bright">Attach Handwritten PIQ</span>
                  <span className="text-[9px] font-black text-app-text-muted uppercase tracking-widest mt-1">Images or PDF</span>
                </label>
                <div className="flex items-center justify-center gap-4 pt-2">
                  <span className="text-[10px] font-black text-app-text-muted uppercase">Missing form?</span>
                  <a 
                    href={downloadUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[10px] font-black text-app-accent uppercase tracking-widest hover:underline"
                  >
                    Download PIQ Form
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Upload Dropzone */}
          <div className="bg-app-sidebar border-2 border-app-border border-dashed rounded-[2.5rem] p-12 text-center hover:border-app-accent/50 transition-all group relative overflow-hidden">
            <input
              type="file"
              id="file-upload"
              multiple
              className="hidden"
              onChange={handleFileChange}
              accept="image/*,application/pdf"
            />
            <label htmlFor="file-upload" className="cursor-pointer block">
              <div className="w-20 h-20 bg-app-card rounded-3xl mx-auto flex items-center justify-center mb-6 border border-app-border group-hover:scale-110 group-hover:bg-app-accent/5 transition-all shadow-inner">
                <Upload size={32} className="text-app-accent" />
              </div>
              <h3 className="text-2xl font-black text-app-text-bright mb-2">Import Stimuli Captures</h3>
              <p className="text-app-text-muted text-sm font-medium">Drag & drop or <span className="text-app-accent">browse filesystem</span></p>
            </label>
          </div>

          {/* File Previews */}
          {files.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-[11px] font-black text-app-text-muted uppercase tracking-widest border-b border-app-border pb-2">
                <span>Queue Information</span>
                <span>{files.length} Entries Ready</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {files.map((file, idx) => (
                  <div key={idx} className="bg-app-card border border-app-border rounded-2xl overflow-hidden group relative h-48 shadow-lg">
                    {previews[idx] === 'PDF_ICON' ? (
                      <div className="flex flex-col items-center justify-center h-full bg-app-sidebar">
                        <FileText size={40} className="text-app-accent" />
                        <span className="text-[10px] font-bold text-app-text-muted mt-2 truncate w-full px-4 text-center">{file.name}</span>
                      </div>
                    ) : (
                      <img src={previews[idx]} alt="Preview" className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                    )}
                    <button 
                      onClick={() => removeFile(idx)}
                      className="absolute top-2 right-2 p-1.5 bg-black/60 backdrop-blur rounded-lg text-white hover:bg-red-500 transition-colors shadow-2xl"
                    >
                      <ArrowLeft size={14} className="rotate-45" />
                    </button>
                    <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                       <span className="text-[9px] font-black text-white/70 uppercase tracking-widest truncate block">
                        IMG_{file.name.slice(0, 8)}
                       </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-app-sidebar border border-app-border rounded-[2rem] p-8 shadow-2xl space-y-8 sticky top-24">
             <div className="space-y-2">
               <h3 className="text-xl font-black text-app-text-bright tracking-tight">Summary</h3>
               <div className="text-[10px] uppercase font-black text-app-text-muted tracking-widest border-b border-app-border pb-4 mb-4">
                Session Ledger
               </div>
             </div>

             <div className="space-y-4">
               <div className="flex justify-between text-sm font-medium">
                 <span className="text-app-text-muted">Battery ID</span>
                 <span className="text-app-text-bright font-mono">{assessment.id.slice(0, 8)}</span>
               </div>
               <div className="flex justify-between text-sm font-medium">
                 <span className="text-app-text-muted">Started</span>
                 <span className="text-app-text-bright">
                  {submission.startedAt ? new Date(submission.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                 </span>
               </div>
               <div className="flex justify-between text-sm font-medium">
                 <span className="text-app-text-muted">Status</span>
                 <span className="text-amber-400">Waiting for Data</span>
               </div>
             </div>

             {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex gap-3 text-red-500 text-xs font-bold leading-relaxed italic">
                  <AlertCircle size={16} className="shrink-0" />
                  {error}
                </div>
             )}

             <button
              onClick={handleSubmit}
              disabled={uploading || files.length === 0 || !piqFile}
              className={cn(
                "w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-3 shadow-lg",
                uploading || files.length === 0 || !piqFile
                  ? "bg-app-card text-app-text-muted border border-app-border cursor-not-allowed opacity-50" 
                  : "bg-gradient-to-br from-[#C5A028] to-[#8C6A0F] text-white hover:opacity-90 hover:scale-[1.02] active:scale-95 shadow-app-accent/30"
              )}
             >
               {uploading ? (
                 <>
                  <Loader2 size={18} className="animate-spin" />
                  Processing...
                 </>
               ) : (
                 <>
                  <CheckCircle2 size={18} />
                  Transmit Dossier
                 </>
               )}
             </button>

             <p className="text-[10px] text-justify text-app-text-muted italic leading-relaxed">
              By transmitting, you confirm that these images represent your original handwritten responses for the specific battery conducted.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubmissionUpload;
