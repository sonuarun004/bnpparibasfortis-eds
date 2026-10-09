package com.bnpparibasfortis.eds.seo;

import java.time.ZoneId;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

import org.apache.commons.lang3.StringUtils;
import org.apache.sling.api.resource.LoginException;
import org.apache.sling.api.resource.ModifiableValueMap;
import org.apache.sling.api.resource.PersistenceException;
import org.apache.sling.api.resource.Resource;
import org.apache.sling.api.resource.ResourceResolver;
import org.apache.sling.api.resource.ResourceResolverFactory;
import org.apache.sling.api.resource.observation.ResourceChange;
import org.apache.sling.api.resource.observation.ResourceChangeListener;
import org.osgi.service.component.annotations.Activate;
import org.osgi.service.component.annotations.Component;
import org.osgi.service.component.annotations.Modified;
import org.osgi.service.component.annotations.Reference;
import org.osgi.service.metatype.annotations.AttributeDefinition;
import org.osgi.service.metatype.annotations.Designate;
import org.osgi.service.metatype.annotations.ObjectClassDefinition;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.day.cq.wcm.api.NameConstants;

/**
 * Keeps each page's JSON-LD up to date on AEM author. Whenever a page's
 * properties or content (e.g. an FAQ item) change, the page's JSON-LD is
 * rebuilt from the authored values and stored in the {@code json-ld} page
 * property, which Edge Delivery renders into the page HTML as
 * {@code <script type="application/ld+json">}. Authors never edit the JSON.
 */
@Component(service = ResourceChangeListener.class, property = {
        ResourceChangeListener.PATHS + "=/content/bnpparibasfortis",
        ResourceChangeListener.CHANGES + "=ADDED",
        ResourceChangeListener.CHANGES + "=CHANGED",
        ResourceChangeListener.CHANGES + "=REMOVED"
})
@Designate(ocd = StructuredDataListener.Config.class)
public class StructuredDataListener implements ResourceChangeListener {

    /** Page property Edge Delivery renders as JSON-LD. */
    static final String PROPERTY = "json-ld";

    /** Service user sub-service, mapped in the service user mapping config. */
    static final String SUBSERVICE = "structured-data";

    private static final Logger LOG = LoggerFactory.getLogger(StructuredDataListener.class);
    private static final String CONTENT_NODE = "/" + NameConstants.NN_CONTENT;

    @ObjectClassDefinition(name = "BNP Paribas Fortis - Structured data (JSON-LD)",
            description = "Generates the schema.org JSON-LD of Edge Delivery pages from authored values.")
    public @interface Config {

        @AttributeDefinition(name = "Enabled")
        boolean enabled() default true;

        @AttributeDefinition(name = "Content root", description = "AEM path mapped to the site root")
        String contentRoot() default "/content/bnpparibasfortis/be";

        @AttributeDefinition(name = "Site origin", description = "Production origin used in URLs")
        String siteOrigin() default "https://www.bnpparibasfortis.be";

        @AttributeDefinition(name = "Country", description = "Appended to the language, e.g. nl-BE")
        String country() default "BE";

        @AttributeDefinition(name = "Time zone", description = "Time zone of the published dates")
        String timeZone() default "Europe/Brussels";

        @AttributeDefinition(name = "FAQ block", description = "Id (filter) of the FAQ block")
        String faqBlock() default "accordion-faq";
    }

    @Reference
    private ResourceResolverFactory resolverFactory;

    private volatile boolean enabled;
    private volatile String contentRoot;
    private volatile StructuredDataBuilder builder;

    @Activate
    @Modified
    protected void activate(Config config) {
        enabled = config.enabled();
        contentRoot = StringUtils.removeEnd(config.contentRoot(), "/");
        builder = new StructuredDataBuilder(contentRoot, config.siteOrigin(), config.country(),
                ZoneId.of(config.timeZone()), config.faqBlock());
    }

    @Override
    public void onChange(List<ResourceChange> changes) {
        if (!enabled) {
            return;
        }
        Set<String> pages = new LinkedHashSet<>();
        for (ResourceChange change : changes) {
            pagePath(change.getPath()).ifPresent(pages::add);
        }
        if (pages.isEmpty()) {
            return;
        }
        Map<String, Object> auth = Collections.singletonMap(ResourceResolverFactory.SUBSERVICE, SUBSERVICE);
        try (ResourceResolver resolver = resolverFactory.getServiceResourceResolver(auth)) {
            for (String page : pages) {
                update(resolver, page);
            }
        } catch (LoginException e) {
            LOG.error("Cannot log in as the {} service user; JSON-LD not updated", SUBSERVICE, e);
        }
    }

    /**
     * Rebuild and store one page's JSON-LD. Only writes when it changed, so the
     * change event caused by the write itself ends here.
     * @return true when the property was written
     */
    boolean update(ResourceResolver resolver, String pagePath) {
        Resource page = resolver.getResource(pagePath);
        Resource content = page != null ? page.getChild(NameConstants.NN_CONTENT) : null;
        if (content == null) {
            return false;
        }
        ModifiableValueMap props = content.adaptTo(ModifiableValueMap.class);
        if (props == null) {
            LOG.warn("No write access to {}; JSON-LD not updated", content.getPath());
            return false;
        }
        Optional<String> jsonLd = builder.build(page);
        String current = props.get(PROPERTY, String.class);
        if (Objects.equals(current, jsonLd.orElse(null))) {
            return false;
        }
        if (jsonLd.isPresent()) {
            props.put(PROPERTY, jsonLd.get());
        } else {
            props.remove(PROPERTY);
        }
        try {
            resolver.commit();
            LOG.debug("Updated the JSON-LD of {}", pagePath);
            return true;
        } catch (PersistenceException e) {
            LOG.error("Cannot store the JSON-LD of {}", pagePath, e);
            resolver.revert();
            return false;
        }
    }

    /**
     * The page a changed resource belongs to: the part before /jcr:content, for
     * anything inside a page's content under the content root.
     */
    Optional<String> pagePath(String path) {
        if (path == null || !path.startsWith(contentRoot + "/")) {
            return Optional.empty();
        }
        int index = path.indexOf(CONTENT_NODE + "/");
        if (index < 0 && path.endsWith(CONTENT_NODE)) {
            index = path.length() - CONTENT_NODE.length();
        }
        return index > 0 ? Optional.of(path.substring(0, index)) : Optional.empty();
    }
}
