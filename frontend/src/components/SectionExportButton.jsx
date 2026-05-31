import React, { useState, useRef, useEffect } from 'react';
import { Download, FileJson, FileText, File as FilePdf, Loader2, ChevronDown, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getProjectExport, getProjectActivity, getProjectMetrics, getProjectCodeQuality, getRepoTree } from '../api/project.api';
import { getAIReport } from '../api/dashboard.api';
import { exportSection, isSectionEmpty } from '../utils/sectionExport';
import { generateSectionPdf } from '../utils/themePdfExport';

/**
 * SectionExportButton
 *
 * Props:
 *   projectId  – the current project ID
 *   section    – one of: "overview" | "ai_analysis" | "repo_tree" | "metrics" | "activity" | "code_quality"
 *   treeText   – (repo_tree only) pre-fetched ASCII/JSON tree string from RepoStructure
 */
export default function SectionExportButton({ projectId, project, section, treeText, projectName, overviewData }) {
  const [isOpen,      setIsOpen]      = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  // 'idle' | 'checking' | 'empty' — tracks the no-data feedback state
  const [feedbackState, setFeedbackState] = useState('idle');
  const dropdownRef  = useRef(null);
  const noDataTimerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      clearTimeout(noDataTimerRef.current);  // clean up auto-reset timer
    };
  }, []);

  const fetchSectionData = async () => {
    switch (section) {
      case 'overview':
        return overviewData || {};
      case 'ai_analysis':
        return await getAIReport(projectId);
      case 'repo_tree':
        if (treeText) return { tree: treeText };
        const treeData = await getRepoTree(projectId, 'ascii');
        return { tree: treeData.tree || '' };
      case 'metrics':
        return await getProjectMetrics(projectId);
      case 'activity':
        return await getProjectActivity(projectId, 'day');
      case 'code_quality':
        return await getProjectCodeQuality(projectId);
      default:
        return {};
    }
  };

  /** Show the "No data available" state in the dropdown for 3 s then reset */
  const showNoData = () => {
    setFeedbackState('empty');
    clearTimeout(noDataTimerRef.current);
    noDataTimerRef.current = setTimeout(() => {
      setFeedbackState('idle');
      setIsOpen(false);
    }, 3000);
  };

  const handleExport = async (format) => {
    try {
      setIsExporting(true);
      setFeedbackState('checking');

      // 1. Fetch section-specific raw data
      const rawData = await fetchSectionData();

      // 2. Guard against empty / error responses — show feedback, bail early
      if (isSectionEmpty(section, rawData)) {
        showNoData();
        return;
      }

      // 3. Close dropdown and shape the payload
      setIsOpen(false);
      setFeedbackState('idle');
      const shaped = exportSection(section, rawData);

      // 4a. PDF → rendered entirely client-side to match the dark UI theme
      if (format === 'pdf') {
        await generateSectionPdf(shaped, projectName || projectId, project);
        return;
      }

      // 4b. JSON / CSV → backend handles format conversion
      const blob = await getProjectExport(projectId, format, shaped);

      // 5. Trigger browser download
      const tempUrl = window.URL.createObjectURL(blob);
      const link    = document.createElement('a');
      link.href     = tempUrl;
      const sectionName = section.charAt(0).toUpperCase() + section.slice(1);
      link.setAttribute('download', `${projectName || projectId}-${sectionName}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(tempUrl);
    } catch (err) {
      console.error(`[SectionExport] ${section} export failed:`, err);
      // Show the no-data message for API / network errors too
      showNoData();
    } finally {
      setIsExporting(false);
      // Only reset feedbackState if we didn't set 'empty' (that clears itself)
      setFeedbackState(prev => prev === 'checking' ? 'idle' : prev);
    }
  };

  const isChecking = feedbackState === 'checking' || isExporting;
  const isEmpty    = feedbackState === 'empty';

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        onClick={() => {
          if (!isChecking) {
            setIsOpen(!isOpen);
            setFeedbackState('idle');
          }
        }}
        disabled={isChecking}
        className={`text-sm flex items-center px-4 py-2 rounded-lg text-white font-medium transition-all duration-200 border ${isOpen ? 'bg-[#2D1B69] border-[#4A2E8A]' : 'bg-[#1E1242] border-[#3B2476] hover:bg-[#2D1B69] hover:border-[#4A2E8A]'} disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {isChecking
          ? <Loader2 size={16} className="mr-2 animate-spin text-neon-purple" />
          : <Download size={16} className="mr-2" />
        }
        {isChecking ? 'Exporting...' : 'Export'}
        <ChevronDown size={16} className={`ml-3 text-white/70 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 mt-2 w-56 rounded-xl bg-[#0B1121] border border-white/10 overflow-hidden z-50"
          >
            {isEmpty ? (
              <div className="flex flex-col items-center gap-2 px-4 py-5 text-center">
                <AlertCircle size={20} className="text-neon-pink/80" />
                <p className="text-sm font-medium text-white/80">No data available</p>
                <p className="text-xs text-text-muted leading-snug">
                  Run a sync first to generate exportable data for this section.
                </p>
              </div>
            ) : (
              <div className="py-2" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                <button
                  onClick={() => handleExport('json')}
                  className="flex items-center w-full px-5 py-3 text-sm font-medium text-white hover:bg-[#1E1B4B] transition-colors"
                  role="menuitem"
                >
                  <FileJson size={18} className="mr-4 text-[#EAB308]" />
                  Download JSON
                </button>
                <button
                  onClick={() => handleExport('csv')}
                  className="flex items-center w-full px-5 py-3 text-sm font-medium text-white hover:bg-[#1E1B4B] transition-colors"
                  role="menuitem"
                >
                  <FileText size={18} className="mr-4 text-[#10B981]" />
                  Download CSV
                </button>
                <div className="h-px bg-white/5 my-1 mx-4" />
                <button
                  onClick={() => handleExport('pdf')}
                  className="flex items-center w-full px-5 py-3 text-sm font-medium text-white hover:bg-[#1E1B4B] transition-colors"
                  role="menuitem"
                >
                  <FilePdf size={18} className="mr-4 text-[#FF2D55]" />
                  Download PDF Report
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
