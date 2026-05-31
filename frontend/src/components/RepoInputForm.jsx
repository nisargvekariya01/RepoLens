import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createProject } from "../api/project.api";
import { Folder, AlertCircle, ChevronRight } from "lucide-react";
import GithubIcon from "./GithubIcon";

export default function RepoInputForm() {
  const navigate = useNavigate();
  const [githubUrl, setGithubUrl] = useState("");
  const [localPath, setLocalPath] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!githubUrl || !githubUrl.includes("github.com")) {
      setError("Please provide a valid GitHub repository URL.");
      return;
    }

    try {
      setLoading(true);
      // Derive project name from the URL path as per backend requirements
      const cleanUrl = githubUrl.trim().replace(/\.git$/, "");
      const parts = new URL(cleanUrl).pathname.split("/").filter(Boolean);
      const derivedName = parts.length >= 2 ? parts[parts.length - 1] : "Imported Repository";

      const payload = {
        name: derivedName,
        github_url: githubUrl.trim()
      };

      if (localPath.trim()) {
        payload.local_path = localPath.trim();
      }

      const res = await createProject(payload);
      
      // Auto-navigate to the new project dashboard upon successful creation
      if (res && res.id) {
        navigate(`/project/${res.id}`);
      } else {
        setError("Repository connected, but failed to retrieve project ID.");
      }
    } catch (err) {
       setError(err.response?.data?.error || "Failed to create project. Verify paths and URLs.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-300">
      <div className="bg-indigo-600 px-6 py-8 text-center">
         <h2 className="text-2xl font-bold text-white mb-2 text-glow">Connect Repository</h2>
         <p className="text-indigo-100 text-sm font-medium">Link a GitHub repository to begin code quality and trend analysis.</p>
      </div>

      <form onSubmit={handleSubmit} className="p-8 space-y-6 bg-gray-50/50">
        
        {error && (
          <div className="flex items-start space-x-3 bg-red-50 text-red-700 p-4 rounded-xl border border-red-100">
            <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {/* GitHub URL Input */}
        <div className="space-y-2">
          <label htmlFor="githubUrl" className="block text-sm font-bold text-gray-700">
            GitHub URL <span className="text-red-500">*</span>
          </label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <GithubIcon className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
            </div>
            <input
              type="url"
              id="githubUrl"
              placeholder="https://github.com/owner/repository"
              required
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm shadow-sm transition-all text-gray-900"
            />
          </div>
        </div>

        {/* Local Path Input */}
        <div className="space-y-2">
          <label htmlFor="localPath" className="flex items-center text-sm font-bold text-gray-700">
            Local Path <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-200 text-gray-600 tracking-wider">OPTIONAL</span>
          </label>
          <p className="text-xs text-gray-500 mb-1 leading-snug">Bind directly to a local clone to bypass GitHub API limits and improve parsing speeds.</p>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Folder className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
            </div>
            <input
              type="text"
              id="localPath"
              placeholder="C:\Projects\my-repository"
              value={localPath}
              onChange={(e) => setLocalPath(e.target.value)}
              className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm shadow-sm transition-all text-gray-900"
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all disabled:opacity-70 disabled:cursor-not-allowed group relative overflow-hidden"
          >
            {loading ? (
              <div className="flex items-center">
                 <div className="animate-spin mr-2 h-4 w-4 border-2 border-b-transparent border-white rounded-full"></div>
                 Analyzing...
              </div>
            ) : (
              <span className="flex items-center">
                Analyze Repository
                <ChevronRight className="ml-2 h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
              </span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
