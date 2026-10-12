import './globalReact';
import '../vendor/bushido/_ds_bundle.js';
import type { ComponentType } from 'react';

/**
 * Bushido v2 components, from project/_ds/bushido-v2/_ds_bundle.js (package 2026.09.21-r2).
 * The bundle is untyped; these are the props this app uses.
 */
type AnyProps = Record<string, unknown> & { children?: React.ReactNode; style?: React.CSSProperties };

interface BushidoNamespace {
  Header: ComponentType<AnyProps>;
  MenuItem: ComponentType<AnyProps>;
  Button: ComponentType<AnyProps>;
  IconButton: ComponentType<AnyProps>;
  Icon: ComponentType<{ name: string; size?: number; style?: React.CSSProperties; 'aria-label'?: string }>;
  FormsSelect: ComponentType<AnyProps>;
  FormsTextField: ComponentType<AnyProps>;
  ResolveIconName(name: string): string | null;
  SetIconBaseUrl(url: string): void;
  __errors: { path: string; error: string }[];
}

const ns = (window as unknown as { BushidoDesignSystem_003450: BushidoNamespace }).BushidoDesignSystem_003450;
ns.SetIconBaseUrl(`${import.meta.env.BASE_URL}bushido/icons/`);

export const DS = ns;
