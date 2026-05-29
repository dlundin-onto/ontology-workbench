import type { Platform } from "../types";

export const PLATFORMS: Platform[] = [
  {
    id: "sql",
    name: "SQL / RDBMS",
    icon: "ti-database",
    desc: "PostgreSQL, SQL Server, Oracle, MySQL",
    color: "#4f8ef7",
    context:
      "SQL RDBMS platforms use tables, foreign keys, indexes, and transactions. Strengths: ACID compliance, mature tooling, complex joins, row-level security. Weaknesses: schema rigidity, object-relational impedance mismatch, poor support for hierarchies and graph traversal, vertical scaling limits. Best fit for: transactional systems, well-understood normalized domains, operational data stores.",
  },
  {
    id: "graph",
    name: "Graph Database",
    icon: "ti-topology-star",
    desc: "Neo4j, Amazon Neptune, Memgraph",
    color: "#34d399",
    context:
      "Graph databases store data as nodes and edges with properties. Strengths: native relationship traversal, pattern matching (Cypher/SPARQL), multi-hop queries, network analysis. Weaknesses: no native aggregation, poor tabular reporting, less mature operational tooling, harder to enforce strict schemas. Best fit for: relationship-heavy domains, knowledge graphs, recommendation engines, lineage tracking.",
  },
  {
    id: "snowflake",
    name: "Snowflake",
    icon: "ti-snowflake",
    desc: "Cloud data warehouse (Snowflake Inc)",
    color: "#22d3ee",
    context:
      "Snowflake is a cloud data warehouse using columnar storage and MPP. Strengths: massive analytical query performance, separation of compute/storage, semi-structured data (VARIANT), time-travel, data sharing. Weaknesses: not designed for transactional OLTP, high latency for point lookups, cost at scale for frequent small queries. Best fit for: analytics, reporting, ML feature stores, data products. Normalization often deliberately relaxed for query performance.",
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
    name: "Inorigo",
    icon: "ti-topology-star-3",
    desc: "Ontology platform (RDF/OWL native)",
    color: "#a78bfa",
    context:
      "Inorigo is an enterprise ontology platform natively supporting RDF/OWL, SHACL validation, and semantic reasoning. Strengths: native metaclass support, attribute inheritance, classification hierarchies, semantic interoperability, standards compliance. Weaknesses: steeper learning curve, smaller ecosystem, SPARQL query complexity, performance on large datasets requires tuning. Best fit for: enterprise knowledge graphs, master data management, cross-domain canonical models — exactly the use case of this workbench.",
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
