import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const checkMobile = () => {
      const ua = navigator.userAgent || navigator.vendor || (window as any).opera
      const width = window.innerWidth < MOBILE_BREAKPOINT
      const coarse = window.matchMedia("(pointer: coarse)").matches
      const mobileUA = /android|iphone|ipad|ipod|mobile/i.test(ua)
      setIsMobile(width || coarse || mobileUA)
    }

    checkMobile()
    window.addEventListener("resize", checkMobile)
    window.addEventListener("orientationchange", checkMobile)

    return () => {
      window.removeEventListener("resize", checkMobile)
      window.removeEventListener("orientationchange", checkMobile)
    }
  }, [])

  return !!isMobile
}
