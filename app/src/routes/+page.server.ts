// This just exists to get these two headers on to the HTML response
// CloudFlare workesr (and also, Vercel), do not seem to faciliate 
// a simple configuration for adding headers, I found this to be
// the most simple and easy-to-control means to add them

export function load({ setHeaders }) {
    setHeaders({
        "Cross-Origin-Embedder-Policy": "require-corp",
        "Cross-Origin-Opener-Policy": "same-origin",
    })
}