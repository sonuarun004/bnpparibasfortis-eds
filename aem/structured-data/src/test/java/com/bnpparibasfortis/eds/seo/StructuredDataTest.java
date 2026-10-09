package com.bnpparibasfortis.eds.seo;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Calendar;
import java.util.Collections;
import java.util.GregorianCalendar;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TimeZone;

import org.apache.sling.api.resource.ModifiableValueMap;
import org.apache.sling.api.resource.Resource;
import org.apache.sling.api.resource.observation.ResourceChange;
import org.apache.sling.api.resource.observation.ResourceChange.ChangeType;
import org.apache.sling.testing.mock.sling.ResourceResolverType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.wcm.testing.mock.aem.junit5.AemContext;
import io.wcm.testing.mock.aem.junit5.AemContextExtension;

@ExtendWith(AemContextExtension.class)
class StructuredDataTest {

    private static final String ROOT = "/content/bnpparibasfortis/be";
    private static final String PAGE = ROOT + "/nl/over-ons/wie-zijn-we/ons-engagement/sponsoring";
    private static final String BLOCK = StructuredDataBuilder.BLOCK_TYPE;
    private static final String ITEM = StructuredDataBuilder.BLOCK_ITEM_TYPE;

    /** Property paths of each item on bnpparibasfortis.be (sponsoring page). */
    private static final List<String> SOURCE_WEBPAGE = Arrays.asList(
            "@type", "name", "description", "url", "datePublished", "dateModified", "inLanguage");
    private static final List<String> SOURCE_FAQPAGE = Arrays.asList(
            "@type", "mainEntity[]", "mainEntity[].@type", "mainEntity[].name", "mainEntity[].acceptedAnswer",
            "mainEntity[].acceptedAnswer.@type", "mainEntity[].acceptedAnswer.text");

    private final AemContext context = new AemContext(ResourceResolverType.JCR_MOCK);
    private final ObjectMapper mapper = new ObjectMapper();
    private StructuredDataBuilder builder;

    @BeforeEach
    void setUp() {
        builder = new StructuredDataBuilder(ROOT, "https://www.bnpparibasfortis.be", "BE",
                ZoneId.of("Europe/Brussels"), "accordion-faq");
    }

    /** The sponsoring page as authored in Universal Editor. */
    private Resource sponsoringPage(boolean withDescription, boolean withFaq) {
        Map<String, Object> props = new HashMap<>();
        props.put("jcr:title", "Sponsoring: partnerships en initiatieven van BNP Paribas Fortis");
        if (withDescription) {
            props.put("jcr:description", "Ontdek de sponsoring van BNP Paribas Fortis: cinema, cultuur en tennis.");
        }
        props.put("cq:lastModified", date(2026, Calendar.OCTOBER, 6, 3, 2, 2));
        context.create().page(PAGE, "/conf/bnpparibasfortis/settings/wcm/templates/page", props);
        context.resourceResolver().getResource(PAGE).adaptTo(ModifiableValueMap.class)
                .put("jcr:created", date(2026, Calendar.MAY, 21, 13, 58, 21));

        String section = PAGE + "/jcr:content/root/section";
        context.create().resource(section, "sling:resourceType", "core/franklin/components/section/v1/section");
        context.create().resource(section + "/text", "sling:resourceType", "core/franklin/components/text/v1/text",
                "text", "<h2>Veelgestelde vragen</h2>");
        if (withFaq) {
            faqBlock(section + "/block", new String[][] {
                {"Wat zijn de 3 pijlers van de sponsoring van BNP Paribas Fortis?",
                    "<p>Onze sponsoringstrategie rust op drie pijlers: cinema, cultuur en tennis.</p>"},
                {"Hoe ondersteunt BNP Paribas Fortis jong talent?",
                    "<p>Via het Flagency-programma &amp; de Justine Henin Academy.</p>"},
            });
            // the FAQ may be authored as one block per question
            faqBlock(section + "/block_1", new String[][] {
                {"Wat zijn de We Love Cinema Days?",
                    "<p>4 dagen waarop iedereen voor slechts 6&euro;&nbsp;naar de film kan.</p>"},
                {"", "<p>an item without a question is skipped</p>"},
            });
        }
        return context.resourceResolver().getResource(PAGE);
    }

    private void faqBlock(String path, String[][] items) {
        context.create().resource(path, "sling:resourceType", BLOCK, "name", "Accordion Faq",
                "filter", "accordion-faq");
        for (int i = 0; i < items.length; i++) {
            context.create().resource(path + "/item" + i, "sling:resourceType", ITEM,
                    "name", "Accordion Faq Item", "model", "accordion-faq-item",
                    "summary", items[i][0], "text", items[i][1]);
        }
    }

    private static Calendar date(int year, int month, int day, int hour, int minute, int second) {
        Calendar calendar = new GregorianCalendar(TimeZone.getTimeZone("UTC"));
        calendar.clear();
        calendar.set(year, month, day, hour, minute, second);
        return calendar;
    }

    private JsonNode item(JsonNode root, String type) {
        for (JsonNode item : root.get("@graph")) {
            if (type.equals(item.get("@type").asText())) {
                return item;
            }
        }
        return null;
    }

    /** Property paths of a JSON item, like the comparison with the source site. */
    private static List<String> paths(JsonNode node, String prefix) {
        List<String> paths = new ArrayList<>();
        node.fields().forEachRemaining((field) -> {
            String path = prefix + field.getKey();
            JsonNode value = field.getValue();
            if (value.isArray() && value.size() > 0 && value.get(0).isObject()) {
                paths.add(path + "[]");
                paths.addAll(paths(value.get(0), path + "[]."));
            } else if (value.isObject()) {
                paths.add(path);
                paths.addAll(paths(value, path + "."));
            } else {
                paths.add(path);
            }
        });
        return paths;
    }

    @Test
    void buildsWebPageAndFaqWithTheSourceProperties() throws Exception {
        JsonNode root = mapper.readTree(builder.build(sponsoringPage(true, true)).orElseThrow());

        assertEquals("https://schema.org", root.get("@context").asText());
        JsonNode webPage = item(root, "WebPage");
        assertEquals(SOURCE_WEBPAGE, paths(webPage, ""));
        assertEquals("Sponsoring: partnerships en initiatieven van BNP Paribas Fortis", webPage.get("name").asText());
        assertEquals("https://www.bnpparibasfortis.be/nl/over-ons/wie-zijn-we/ons-engagement/sponsoring",
                webPage.get("url").asText());
        assertEquals("2026-05-21T15:58:21+02:00", webPage.get("datePublished").asText());
        assertEquals("2026-10-06T05:02:02+02:00", webPage.get("dateModified").asText());
        assertEquals("nl-BE", webPage.get("inLanguage").asText());

        JsonNode faq = item(root, "FAQPage");
        assertEquals(SOURCE_FAQPAGE, paths(faq, ""));
        JsonNode questions = faq.get("mainEntity");
        assertEquals(3, questions.size(), "questions from both FAQ blocks, empty ones skipped");
        assertEquals("Hoe ondersteunt BNP Paribas Fortis jong talent?", questions.get(1).get("name").asText());
        assertEquals("Via het Flagency-programma & de Justine Henin Academy.",
                questions.get(1).get("acceptedAnswer").get("text").asText());
        assertEquals("4 dagen waarop iedereen voor slechts 6€ naar de film kan.",
                questions.get(2).get("acceptedAnswer").get("text").asText());
    }

    @Test
    void leavesOutPropertiesThatAreNotAuthored() throws Exception {
        JsonNode root = mapper.readTree(builder.build(sponsoringPage(false, false)).orElseThrow());

        assertEquals(1, root.get("@graph").size(), "no FAQPage without FAQ blocks");
        JsonNode webPage = item(root, "WebPage");
        assertFalse(webPage.has("description"));
        assertNull(item(root, "FAQPage"));
    }

    @Test
    void buildsNothingForAPageWithoutTitleOrFaq() {
        context.create().page(ROOT + "/nl/empty", "/conf/bnpparibasfortis/settings/wcm/templates/page");
        context.resourceResolver().getResource(ROOT + "/nl/empty/jcr:content")
                .adaptTo(ModifiableValueMap.class).remove("jcr:title");

        assertEquals(Optional.empty(), builder.build(context.resourceResolver().getResource(ROOT + "/nl/empty")));
    }

    @Test
    void mapsLanguageAndUrl() {
        assertEquals("https://www.bnpparibasfortis.be/fr/", builder.url(ROOT + "/fr"));
        assertNull(builder.url("/content/other/page"));
        assertEquals("fr-BE", builder.language(ROOT + "/fr/a-propos", null));
        assertEquals("en-GB", builder.language(ROOT + "/en/about", "en_GB"));
        assertEquals("nl-BE", builder.language(ROOT + "/en/about", "nl"));
    }

    @Test
    void listenerStoresTheJsonLdAndOnlyRewritesWhenItChanges() {
        sponsoringPage(true, true);
        StructuredDataListener listener = context.registerInjectActivateService(new StructuredDataListener());

        assertTrue(listener.update(context.resourceResolver(), PAGE));
        String stored = context.resourceResolver().getResource(PAGE + "/jcr:content").getValueMap()
                .get(StructuredDataListener.PROPERTY, String.class);
        assertEquals(builder.build(context.resourceResolver().getResource(PAGE)).orElseThrow(), stored);

        // the change event caused by our own write does not write again
        assertFalse(listener.update(context.resourceResolver(), PAGE));

        // an author edit (new description) updates it
        context.resourceResolver().getResource(PAGE + "/jcr:content").adaptTo(ModifiableValueMap.class)
                .put("jcr:description", "Nieuwe beschrijving");
        assertTrue(listener.update(context.resourceResolver(), PAGE));
        assertTrue(context.resourceResolver().getResource(PAGE + "/jcr:content").getValueMap()
                .get(StructuredDataListener.PROPERTY, String.class).contains("Nieuwe beschrijving"));
    }

    @Test
    void listenerMapsChangedResourcesToTheirPage() {
        StructuredDataListener listener = context.registerInjectActivateService(new StructuredDataListener());

        assertEquals(Optional.of(PAGE), listener.pagePath(PAGE + "/jcr:content"));
        assertEquals(Optional.of(PAGE), listener.pagePath(PAGE + "/jcr:content/root/section/block/item0"));
        assertEquals(Optional.empty(), listener.pagePath(PAGE));
        assertEquals(Optional.empty(), listener.pagePath("/content/dam/bnpparibasfortis/image.jpg/jcr:content"));
        assertEquals(Optional.empty(), listener.pagePath("/conf/bnpparibasfortis/jcr:content"));
    }

    @Test
    void onChangeUpdatesEachChangedPageOnce() {
        sponsoringPage(true, true);
        StructuredDataListener listener = context.registerInjectActivateService(new StructuredDataListener());

        listener.onChange(Arrays.asList(
                new ResourceChange(ChangeType.CHANGED, PAGE + "/jcr:content", false),
                new ResourceChange(ChangeType.ADDED, PAGE + "/jcr:content/root/section/block/item1", false),
                new ResourceChange(ChangeType.CHANGED, "/content/dam/bnpparibasfortis/x/jcr:content", false)));

        context.resourceResolver().refresh();
        String stored = context.resourceResolver().getResource(PAGE + "/jcr:content").getValueMap()
                .get(StructuredDataListener.PROPERTY, String.class);
        assertTrue(stored != null && stored.contains("\"FAQPage\""), "JSON-LD stored via the service user");
    }

    @Test
    void disabledListenerDoesNothing() {
        sponsoringPage(true, true);
        StructuredDataListener listener = context.registerInjectActivateService(new StructuredDataListener(),
                Collections.singletonMap("enabled", false));

        listener.onChange(Collections.singletonList(
                new ResourceChange(ChangeType.CHANGED, PAGE + "/jcr:content", false)));

        assertNull(context.resourceResolver().getResource(PAGE + "/jcr:content").getValueMap()
                .get(StructuredDataListener.PROPERTY, String.class));
    }
}
