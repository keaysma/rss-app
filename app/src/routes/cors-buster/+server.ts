// https://localhost:5173/cors-buster?page=https%3A%2F%2Ffiarfliart.tumblr.com%2Frss
export async function GET(event) {
    const rawPageURL = event.url.searchParams.get("page");
    if (!rawPageURL) {
        return new Response("Missing page URL", { status: 400 });
    }

    const pageURL = decodeURIComponent(rawPageURL);

    const response = await fetch(pageURL);
    const rawContentType = response.headers.get("content-type");
    const contentType = rawContentType ? rawContentType.split(";")[0] : "";

    switch (contentType) {
        case "application/xml":
        case "application/rss+xml":
        case "application/atom+xml":
        case "text/html":
        case "text/xml":
        case "text/rss+xml":
        case "text/atom+xml":
            const text = await response.text();
            return new Response(text, {
                headers: {
                    "content-type": "application/xml",
                },
            });
        case "image/png":
        case "image/jpeg":
        case "image/gif":
        case "image/webp":
            const blob = await response.blob();
            return new Response(blob, {
                headers: {
                    "content-type": contentType,
                },
            });
        default:
            return new Response(
                JSON.stringify(
                    {
                        error: "Invalid content type",
                        details: {
                            "Content-Type": contentType,
                        }
                    }
                ),
                {
                    status: 400,
                    headers: {
                        "content-type": "application/json",
                    },
                }
            );
    }
}