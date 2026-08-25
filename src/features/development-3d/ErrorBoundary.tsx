'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ShieldAlert, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class Development3DErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('3D Development Workspace Error caught by Boundary:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full min-h-[460px] bg-[#0d111a] border border-rose-900/60 rounded-xl p-6 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-rose-950/80 border border-rose-600 flex items-center justify-center text-rose-400 mb-4 shadow-lg">
            <ShieldAlert className="w-6 h-6" />
          </div>
          
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider mb-1">
            {this.props.fallbackTitle || '3D Workspace Unavailable'}
          </h3>
          
          <p className="text-xs text-slate-400 max-w-md mb-4 leading-relaxed">
            The 3D view could not be displayed. Your opportunity inputs, development figures, sources, assumptions, and 2D site plan remain available.
          </p>

          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 px-4 py-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-lg text-xs font-semibold shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reload 3D Workspace
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
