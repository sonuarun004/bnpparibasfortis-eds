package com.bnpparibasfortis.eds.seo;

import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.Calendar;
import java.util.Optional;

import org.apache.commons.lang3.StringUtils;
import org.apache.commons.text.StringEscapeUtils;
import org.apache.sling.api.resource.Resource;
import org.apache.sling.api.resource.ValueMap;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

/**
 * Builds the schema.org JSON-LD for one page, from what is authored on it:
 * <ul>
 * <li>WebPage: title, description, URL, dates and language from the page properties</li>
 * <li>FAQPage: the questions and answers of the page's FAQ blocks</li>
 * </ul>
 * A property is only included when its authored value exists, and only the
 * properties bnpparibasfortis.be uses are written. Both items go into one
 * {@code @graph}, because Edge Delivery allows one JSON-LD block per page.
 */
public final class StructuredDataBuilder {

    /** Resource type of Edge Delivery (xwalk) blocks and their items. */
    static final String BLOCK_TYPE = "core/franklin/components/block/v1/block";
    static final String BLOCK_ITEM_TYPE = "core/franklin/components/block/v1/block/item";

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    private final String contentRoot;
    private final String siteOrigin;
    private final String country;
    private final ZoneId zone;
    private final String faqBlock;

    /**
     * @param contentRoot AEM path that maps to the site root, e.g. /content/bnpparibasfortis/be
     * @param siteOrigin production origin, e.g. https://www.bnpparibasfortis.be
     * @param country country appended to the language, e.g. BE (nl-BE)
     * @param zone time zone for the dates
     * @param faqBlock id of the FAQ block (its filter), e.g. accordion-faq
     */
    public StructuredDataBuilder(String contentRoot, String siteOrigin, String country, ZoneId zone,
            String faqBlock) {
        this.contentRoot = StringUtils.removeEnd(contentRoot, "/");
        this.siteOrigin = StringUtils.removeEnd(siteOrigin, "/");
        this.country = country;
        this.zone = zone;
        this.faqBlock = faqBlock;
    }

    /**
     * @param page the cq:Page resource
     * @return the JSON-LD, or empty when the page has nothing to describe
     */
    public Optional<String> build(Resource page) {
        Resource content = page.getChild("jcr:content");
        if (content == null) {
            return Optional.empty();
        }
        ObjectNode root = MAPPER.createObjectNode();
        root.put("@context", "https://schema.org");
        ArrayNode graph = root.putArray("@graph");

        ObjectNode webPage = webPage(page, content);
        if (webPage != null) {
            graph.add(webPage);
        }
        ObjectNode faqPage = faqPage(content);
        if (faqPage != null) {
            graph.add(faqPage);
        }
        if (graph.isEmpty()) {
            return Optional.empty();
        }
        try {
            return Optional.of(MAPPER.writerWithDefaultPrettyPrinter().writeValueAsString(root));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot write JSON-LD for " + page.getPath(), e);
        }
    }

    private ObjectNode webPage(Resource page, Resource content) {
        ValueMap props = content.getValueMap();
        String title = props.get("jcr:title", String.class);
        if (StringUtils.isBlank(title)) {
            return null;
        }
        ObjectNode node = MAPPER.createObjectNode();
        node.put("@type", "WebPage");
        node.put("name", title.trim());
        putIfPresent(node, "description", props.get("jcr:description", String.class));
        putIfPresent(node, "url", url(page.getPath()));
        putIfPresent(node, "datePublished", date(created(page, content)));
        putIfPresent(node, "dateModified", date(props.get("cq:lastModified", Calendar.class)));
        putIfPresent(node, "inLanguage", language(page.getPath(), props.get("jcr:language", String.class)));
        return node;
    }

    private ObjectNode faqPage(Resource content) {
        ArrayNode questions = MAPPER.createArrayNode();
        collectQuestions(content, questions);
        if (questions.isEmpty()) {
            return null;
        }
        ObjectNode node = MAPPER.createObjectNode();
        node.put("@type", "FAQPage");
        node.set("mainEntity", questions);
        return node;
    }

    /** Walks the page content in document order and adds every FAQ item. */
    private void collectQuestions(Resource resource, ArrayNode questions) {
        for (Resource child : resource.getChildren()) {
            if (isFaqBlock(child)) {
                for (Resource item : child.getChildren()) {
                    addQuestion(item.getValueMap(), questions);
                }
            } else {
                collectQuestions(child, questions);
            }
        }
    }

    private boolean isFaqBlock(Resource resource) {
        ValueMap props = resource.getValueMap();
        return BLOCK_TYPE.equals(resource.getResourceType())
                && (faqBlock.equals(props.get("filter", String.class))
                        || faqBlock.equals(props.get("model", String.class)));
    }

    private static void addQuestion(ValueMap item, ArrayNode questions) {
        String question = plainText(item.get("summary", String.class));
        String answer = plainText(item.get("text", String.class));
        if (question.isEmpty() || answer.isEmpty()) {
            return;
        }
        ObjectNode node = questions.addObject();
        node.put("@type", "Question");
        node.put("name", question);
        ObjectNode accepted = node.putObject("acceptedAnswer");
        accepted.put("@type", "Answer");
        accepted.put("text", answer);
    }

    /** Production URL of a page: the content root maps to the site root (no /public). */
    String url(String pagePath) {
        if (!pagePath.startsWith(contentRoot + "/")) {
            return null;
        }
        String path = pagePath.substring(contentRoot.length());
        // a language root (e.g. /nl) is served as /nl/
        if (StringUtils.countMatches(path, '/') == 1) {
            path += "/";
        }
        return siteOrigin + path;
    }

    /** nl-BE: from jcr:language when set, else the page's language folder. */
    String language(String pagePath, String jcrLanguage) {
        if (StringUtils.isNotBlank(jcrLanguage)) {
            String tag = jcrLanguage.trim().replace('_', '-');
            return tag.contains("-") ? tag : tag + "-" + country;
        }
        if (!pagePath.startsWith(contentRoot + "/")) {
            return null;
        }
        String first = StringUtils.substringBefore(pagePath.substring(contentRoot.length() + 1), "/");
        return first.matches("[a-z]{2}") ? first + "-" + country : null;
    }

    private static Calendar created(Resource page, Resource content) {
        Calendar created = page.getValueMap().get("jcr:created", Calendar.class);
        return created != null ? created : content.getValueMap().get("jcr:created", Calendar.class);
    }

    private String date(Calendar calendar) {
        if (calendar == null) {
            return null;
        }
        return calendar.toInstant().truncatedTo(ChronoUnit.SECONDS).atZone(zone).format(DATE_FORMAT);
    }

    /** Rich text to plain text: tags removed, entities decoded, whitespace collapsed. */
    static String plainText(String html) {
        if (html == null) {
            return "";
        }
        String text = StringEscapeUtils.unescapeHtml4(html.replaceAll("<[^>]*>", " "));
        return text.replace('\u00a0', ' ').replaceAll("\\s+", " ").trim();
    }

    private static void putIfPresent(ObjectNode node, String property, String value) {
        if (StringUtils.isNotBlank(value)) {
            node.put(property, value.trim());
        }
    }
}
