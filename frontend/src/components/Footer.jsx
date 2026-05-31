import React from "react";
import GithubIcon from "./GithubIcon";
import RepoLensLogo from "./RepoLensLogo";

const Footer = () => (
  <footer className="border-t border-white/10 bg-[#050816] pt-20 pb-10 relative z-10">
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-16">
        <div className="col-span-2 md:col-span-2">
          <div className="mb-6">
            <RepoLensLogo size="md" showWordmark={true} />
          </div>
          <p className="text-slate-400 text-sm max-w-xs mb-4">
            The AI-first platform for repository intelligence, technical debt
            detection, and architecture visualization.
          </p>
          <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-xs text-slate-400 max-w-xs mb-6">
            <span className="text-blue-400 font-semibold">Please Note:</span> This is a demonstration project. It does not provide a complete set of features or production-ready capabilities.
          </div>
          <div className="flex gap-4">
            <a
              href="#"
              className="text-slate-500 hover:text-white transition-colors"
            >
              <GithubIcon size={20} />
            </a>
          </div>
        </div>

        <div>
          <h4 className="text-white font-bold mb-6">Product</h4>
          <ul className="space-y-4 text-sm text-slate-400">
            <li>
              <a
                href="/#features"
                className="hover:text-white transition-colors"
              >
                Features
              </a>
            </li>
            <li>
              <a
                href="/#how-it-works"
                className="hover:text-white transition-colors"
              >
                How it Works
              </a>
            </li>
            <li>
              <a
                href="/#pricing"
                className="hover:text-white transition-colors"
              >
                Pricing
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-white transition-colors">
                Changelog
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-white font-bold mb-6">Resources</h4>
          <ul className="space-y-4 text-sm text-slate-400">
            <li>
              <a href="#" className="hover:text-white transition-colors">
                Documentation
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-white transition-colors">
                API Reference
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-white transition-colors">
                Blog
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-white transition-colors">
                Community
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-white font-bold mb-6">Company</h4>
          <ul className="space-y-4 text-sm text-slate-400">
            <li>
              <a href="#" className="hover:text-white transition-colors">
                About
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-white transition-colors">
                Careers
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-white transition-colors">
                Privacy Policy
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-white transition-colors">
                Terms of Service
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
        <div>
          &copy; {new Date().getFullYear()} RepoLens Inc. All rights reserved.
        </div>
        <div className="flex gap-6">
          <span className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div> All
            systems operational
          </span>
        </div>
      </div>
    </div>
  </footer>
);

export default Footer;
