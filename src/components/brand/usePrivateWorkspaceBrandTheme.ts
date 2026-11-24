import {useEffect,useLayoutEffect,useState} from 'react';
import {getTenantPublicInfoFlexible} from '@/api/tenant';
import type {PrivateWorkspaceIdentity} from '@/utils/privateWorkspaceIdentity';
import {exactInstitutionSlug} from '@/utils/publishedTenantIdentity';
import {applyWidgetThemeVariables,widgetThemeVariables} from '@/utils/widgetTheme';
import {
  brandAccentVariables,brandFontStack,ensureBrandStylesheet,type PublicBrandIdentity,
} from '@/utils/publicBrandIdentity';
import type {PublicWorkspaceAppearance} from '@/utils/publicWorkspaceAppearance';

interface PrivateWorkspaceBrandTheme {slug:string;appearance:PublicWorkspaceAppearance|null;brand:PublicBrandIdentity|null}
// One public read per organization and page lifetime: the panel navigates a lot.
const cache=new Map<string,PrivateWorkspaceBrandTheme>();
/** Test seam: forget the cached organizations. */
export const resetPrivateWorkspaceBrandThemeCache=()=>cache.clear();

/**
 * White label for the private panel (claims, surveys, statistics…): the same
 * public palette, typography and accents as the organization's portal.
 * Presentation only. It reads the organization's public profile for the
 * verified panel identity, and everything it sets on the page is restored
 * when the panel closes or the organization changes.
 */
export function usePrivateWorkspaceBrandTheme(identity:PrivateWorkspaceIdentity|null,active:boolean):PublicBrandIdentity|null {
  return useOrganizationBrandTheme(active?identity?.tenantSlug:null);
}

/**
 * The same white label for any page of one organization (for example a public
 * survey): `slug` has to be already verified for the page; without it the
 * page keeps the platform look.
 */
export function useOrganizationBrandTheme(organizationSlug:string|null|undefined):PublicBrandIdentity|null {
  const slug=exactInstitutionSlug(organizationSlug);
  const [theme,setTheme]=useState<PrivateWorkspaceBrandTheme|null>(()=>slug?cache.get(slug)??null:null);
  useEffect(()=>{
    if(!slug){setTheme(null);return;}
    const cached=cache.get(slug);
    if(cached){setTheme(cached);return;}
    let cancelled=false;
    getTenantPublicInfoFlexible(slug).then(info=>{
      // The public profile has to be exactly the panel's organization.
      if(cancelled||exactInstitutionSlug(info?.slug)!==slug)return;
      const appearance=info.workspace_appearance?.tenantSlug===slug?info.workspace_appearance:null;
      const value={slug,appearance,brand:info.brand_identity??null};
      cache.set(slug,value);setTheme(value);
    }).catch(()=>{/* Without a public profile the panel keeps the platform look. */});
    return()=>{cancelled=true;};
  },[slug]);
  const current=theme&&theme.slug===slug?theme:null;
  const primary=current?.appearance?.primary,accent=current?.appearance?.accent,brand=current?.brand??null;
  useLayoutEffect(()=>{
    if(!primary||!accent)return;
    return applyWidgetThemeVariables(document.documentElement,widgetThemeVariables({},{primary,secondary:accent}));
  },[primary,accent]);
  useLayoutEffect(()=>{
    if(!brand)return;
    const root=document.documentElement,body=document.body;
    const restoreAccents=applyWidgetThemeVariables(root,brandAccentVariables(brand));
    const previous={marker:root.dataset.brandIdentity,font:body.style.fontFamily,spacing:body.style.letterSpacing};
    root.dataset.brandIdentity='published';
    const stack=brandFontStack(brand.typography);
    if(stack){
      ensureBrandStylesheet(brand.typography?.stylesheetUrl);
      body.style.fontFamily=stack;
      if(brand.typography?.letterSpacing)body.style.letterSpacing=brand.typography.letterSpacing;
    }
    return()=>{
      restoreAccents();
      if(previous.marker===undefined)delete root.dataset.brandIdentity;else root.dataset.brandIdentity=previous.marker;
      body.style.fontFamily=previous.font;body.style.letterSpacing=previous.spacing;
    };
  },[brand]);
  return brand;
}
