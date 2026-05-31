import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const JUSO_API_KEY = "devU01TX0FVVEgyMDI2MDUzMTA2MTYxMDExNTQ3NTk=";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const keyword = url.searchParams.get("keyword") || "";
    const page = url.searchParams.get("page") || "1";
    const countPerPage = url.searchParams.get("countPerPage") || "10";

    if (!keyword || keyword.trim().length < 2) {
      return new Response(
        JSON.stringify({ results: [], totalCount: 0, error: "검색어는 2자 이상 입력하세요" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiUrl = new URL("https://business.juso.go.kr/addrlink/addrLinkApi.do");
    apiUrl.searchParams.set("confmKey", JUSO_API_KEY);
    apiUrl.searchParams.set("currentPage", page);
    apiUrl.searchParams.set("countPerPage", countPerPage);
    apiUrl.searchParams.set("keyword", keyword.trim());
    apiUrl.searchParams.set("resultType", "json");

    const response = await fetch(apiUrl.toString());
    const data = await response.json();

    const common = data?.results?.common;
    if (common?.errorCode !== "0") {
      return new Response(
        JSON.stringify({ results: [], totalCount: 0, error: common?.errorMessage || "API 오류" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const juso = data?.results?.juso || [];
    const results = juso.map((item: Record<string, string>) => ({
      roadAddr: item.roadAddr || "",
      jibunAddr: item.jibunAddr || "",
      zipNo: item.zipNo || "",
      bdNm: item.bdNm || "",
      siNm: item.siNm || "",
      sggNm: item.sggNm || "",
      emdNm: item.emdNm || "",
      roadAddrPart1: item.roadAddrPart1 || "",
      roadAddrPart2: item.roadAddrPart2 || "",
      admCd: item.admCd || "",
      rnMgtSn: item.rnMgtSn || "",
      bdMgtSn: item.bdMgtSn || "",
    }));

    return new Response(
      JSON.stringify({
        results,
        totalCount: parseInt(common?.totalCount || "0", 10),
        currentPage: parseInt(page, 10),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ results: [], totalCount: 0, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
