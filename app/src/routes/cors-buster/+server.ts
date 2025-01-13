// https://localhost:5173/cors-buster?page=https%3A%2F%2Ffiarfliart.tumblr.com%2Frss
export async function GET(event) {
    const rawPageURL = event.url.searchParams.get("page");
    if (!rawPageURL) {
        return new Response("Missing page URL", { status: 400 });
    }

    const pageURL = decodeURIComponent(rawPageURL);

    const response = await fetch(pageURL);
    const text = await response.text();
    return new Response(text, {
        headers: {
            "content-type": "application/xml",
            "Access-Control-Allow-Origin": "*",
        },
    });
}