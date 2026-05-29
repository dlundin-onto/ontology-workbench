import type { Platform } from "../types";

export const PLATFORMS: Platform[] = [
  {
    id: "sql",
    name: "SQL / RDBMS",
    icon: "ti-database",
    desc: "PostgreSQL, SQL Server, Oracle, MySQL",
    color: "#4f8ef7",
    context:
      "SQL RDBMS platforms (PostgreSQL, SQL Server, Oracle, MySQL) implement the relational model: data stored in normalised tables with enforced foreign-key constraints, ACID transactions, and mature index-based query optimisation. Strengths: decades of tooling maturity, strong ACID guarantees, rich join semantics, row-level security, declarative constraint enforcement, wide ecosystem of ORMs and reporting tools. Weaknesses: schema changes on large tables are expensive, object-relational impedance mismatch increases application complexity, recursive/hierarchical queries (CTEs) are verbose and can be slow at depth, horizontal sharding is complex and often application-managed, JSON support has improved but remains secondary to the relational model. Best fit for: transactional OLTP systems, well-understood normalised domains, operational data stores, ERP/CRM backends, any system where ACID guarantees and referential integrity are non-negotiable.",
  },
  {
    id: "graph",
    name: "Graph Database",
    icon: "ti-topology-star",
    desc: "Neo4j, Amazon Neptune, Memgraph",
    color: "#34d399",
    context:
      "Property graph databases (Neo4j, Amazon Neptune, Memgraph) store data as typed nodes and directed edges, each carrying arbitrary key-value properties. Neptune also supports RDF/SPARQL alongside Gremlin/openCypher. Strengths: native multi-hop relationship traversal at constant time per hop regardless of dataset size, expressive pattern matching (Cypher, Gremlin, SPARQL), natural fit for network topology, lineage, and recommendation workloads, flexible schema evolution without migrations. Weaknesses: no native aggregation engine (analytical queries require export or a companion OLAP layer), poor fit for tabular/columnar reporting, schema enforcement requires application-level or SHACL-style constraint layers, operational tooling and DBA skillsets are less mature than RDBMS, Cypher and Gremlin dialects differ across vendors. Best fit for: relationship-heavy domains (supply chain, org charts, access control, fraud detection), knowledge graphs, recommendation engines, data lineage and impact analysis, any use case where traversal depth and pattern matching dominate over aggregation.",
  },
  {
    id: "snowflake",
    name: "Cloud Data Warehouse",
    icon: "ti-snowflake",
    desc: "Snowflake, Amazon Redshift, Google BigQuery",
    color: "#22d3ee",
    context:
      "Cloud data warehouses (Snowflake, Amazon Redshift, Google BigQuery) use columnar storage and massively parallel processing for analytical workloads. All three separate compute from storage and scale elastically. Snowflake: strong semi-structured support (VARIANT/JSON), time-travel, data sharing, and Iceberg table format; strongest schema flexibility. Redshift: tightly integrated with AWS ecosystem, RA3 nodes for compute/storage separation, Spectrum for S3 querying; best for existing AWS-heavy orgs. BigQuery: serverless, pay-per-query, native nested/repeated records, strong ML integration via BigQuery ML and Vertex AI; best for GCP-native workloads. Shared weaknesses across all three: optimised for analytical reads not transactional OLTP, high latency and cost for frequent small point-lookups, referential integrity is not enforced at the platform level. Normalisation is often deliberately relaxed — star/snowflake schemas and wide denormalised tables are common patterns. Best fit for: BI and reporting, ML feature stores, data products, analytics layers above operational systems.",
  },
  {
    id: "databricks",
    name: "Databricks",
    icon: "ti-flame",
    desc: "Lakehouse / Delta Lake / Unity Catalog",
    color: "#f97316",
    context:
      "Databricks is a lakehouse platform combining Delta Lake storage with Spark compute. Strengths: massive scale, unified batch+streaming, MLflow integration, Delta sharing, Unity Catalog for governance. Weaknesses: not a transactional system, eventual consistency patterns, complex operations model, expensive for small datasets. Best fit for: AI/ML pipelines, large-scale data engineering, feature stores, unified analytics.",
  },
  {
    id: "inorigo",
    name: "Metagraph / Hypergraph",
    icon: "ti-topology-star-3",
    desc: "Inorigo, Protégé / OWL, hypergraph platforms",
    color: "#a78bfa",
    context:
      "Metagraph and hypergraph platforms model entities, relationships, and metadata as first-class typed objects with their own identity, attributes, and classification hierarchies. Representative platforms: Inorigo (enterprise ontology and metagraph platform with a commercial deployment layer), Protégé with OWL/SHACL (open-source ontology editor and reasoning framework), and purpose-built hypergraph databases. Strengths: native metaclass support (Entity, Relation, Attribute, ValueSet as typed constructs), attribute inheritance through classification chains, reified relationships with their own properties (validFrom, weight, role, status), SHACL constraint validation, semantic reasoning and inference, RDF/OWL standards compliance, rich querying via SPARQL, strong cross-domain interoperability. Weaknesses: steeper learning curve than relational or document models, smaller developer ecosystems, SPARQL complexity relative to SQL, performance on very large datasets requires specialist tuning, limited off-the-shelf BI and reporting tooling, commercial platforms (Inorigo) have licensing costs. Best fit for: enterprise knowledge management, master data management, cross-domain canonical ontologies, regulatory compliance metadata, ontology-driven application development, scenarios requiring rich semantic inference and standards-based interoperability.",
  },
  {
    id: "mongodb",
    name: "MongoDB / Atlas",
    icon: "ti-leaf",
    desc: "Document store / Atlas cloud",
    color: "#6ee7b7",
    context:
      "MongoDB stores data as BSON documents with flexible schemas. Strengths: flexible schema evolution, nested documents avoid joins for co-located data, horizontal scaling, Atlas Search, Atlas Vector Search for AI. Weaknesses: no native referential integrity, multi-document transactions add complexity, denormalization is expected and planned — conflicts with 3NF canonical models. Best fit for: content-heavy systems, event stores, systems with variable structure.",
  },
  {
    id: "kafka",
    name: "Kafka / Event Mesh",
    icon: "ti-wave-sine",
    desc: "Confluent, MSK, Azure Event Hub",
    color: "#fbbf24",
    context:
      "Kafka is a distributed event streaming platform, not a database. Strengths: high-throughput ordered event logs, decoupled producers/consumers, Schema Registry for Avro/Protobuf/JSON Schema, exactly-once semantics. Weaknesses: not a query engine, no native entity model, data model expressed as event schemas not entity graphs, retention-based not entity-based. Best fit for: integration layer, CDC, event-driven architectures — model must be translated to event schemas.",
  },
];

export const MATRIX_DIMENSIONS = [
  {
    id: "normalization",
    label: "Normalization fit",
    desc: "How well the platform supports 3NF canonical models without forcing denormalization",
  },
  {
    id: "hierarchy",
    label: "Hierarchy / taxonomy",
    desc: "Native support for parent-child classification and attribute inheritance",
  },
  {
    id: "relations",
    label: "Relationship traversal",
    desc: "Efficiency of traversing entity relations and M:N patterns",
  },
  {
    id: "temporal",
    label: "Temporal / versioning",
    desc: "Built-in support for valid time, bi-temporal patterns, and history",
  },
  {
    id: "ai_readiness",
    label: "AI / ML readiness",
    desc: "Suitability as a feature store or knowledge source for AI/ML workloads",
  },
  {
    id: "governance",
    label: "Governance / lineage",
    desc: "Data cataloguing, lineage, access control, and GDPR tooling",
  },
  {
    id: "scalability",
    label: "Scale at volume",
    desc: "Performance characteristics under high data volumes",
  },
  {
    id: "integration",
    label: "Integration / interop",
    desc: "API patterns, event streaming, and standards compliance (REST, GraphQL, RDF)",
  },
];
