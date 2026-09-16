"use client";

import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    backgroundColor: "#ffffff",
  },
  header: {
    textAlign: "center",
    marginBottom: 24,
  },
  logo: {
    width: 56,
    height: 56,
    alignSelf: "center",
    marginBottom: 12,
  },
  eventName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#c8102e",
    marginBottom: 8,
  },
  eventMeta: {
    fontSize: 12,
    color: "#71717a",
    marginBottom: 4,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e8",
    marginVertical: 20,
  },
  guestSection: {
    marginBottom: 20,
  },
  guestName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#18181b",
    marginBottom: 6,
  },
  guestMeta: {
    fontSize: 12,
    color: "#71717a",
    marginBottom: 2,
  },
  qrSection: {
    alignItems: "center",
    marginTop: 10,
  },
  qrImage: {
    width: 160,
    height: 160,
    marginBottom: 10,
  },
  qrLabel: {
    fontSize: 11,
    color: "#c8102e",
    fontWeight: "bold",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 10,
    color: "#a1a1aa",
  },
});

interface InvitacionPdfProps {
  evento: {
    nombre: string;
    fecha: string;
    hora: string;
    lugar: string;
  };
  invitado: {
    nombre: string;
    cargo: string;
  };
  enteNombre: string;
  qrDataUrl: string;
}

export function InvitacionPdfDocument({
  evento,
  invitado,
  enteNombre,
  qrDataUrl,
}: InvitacionPdfProps) {
  const logoUrl =
    typeof window !== "undefined"
      ? new URL("/logo_intitucional.jpeg", window.location.origin).href
      : "/logo_intitucional.jpeg";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {/* react-pdf's Image is not an HTML image and does not support alt. */}
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image style={styles.logo} src={logoUrl} />
          <Text style={styles.eventName}>{evento.nombre}</Text>
          <Text style={styles.eventMeta}>
            {evento.fecha} · {evento.hora}
          </Text>
          <Text style={styles.eventMeta}>{evento.lugar}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.guestSection}>
          <Text style={styles.guestName}>
            {invitado.nombre}
          </Text>
          <Text style={styles.guestMeta}>{invitado.cargo}</Text>
          <Text style={styles.guestMeta}>{enteNombre}</Text>
        </View>

        <View style={styles.qrSection}>
          {/* react-pdf's Image is not an HTML image and does not support alt. */}
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image style={styles.qrImage} src={qrDataUrl} />
          <Text style={styles.qrLabel}>Presenta este QR en la entrada</Text>
        </View>

        <View style={styles.footer}>
          <Text>Generado con inviteting · Invitación personal e intransferible</Text>
        </View>
      </Page>
    </Document>
  );
}
