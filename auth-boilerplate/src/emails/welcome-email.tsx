import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
  pixelBasedPreset,
} from "@react-email/components";

export interface WelcomeEmailProps {
  email: string;
  userName?: string;
  baseUrl?: string;
}

export const WelcomeEmail = ({
  userName,
  baseUrl,
}: WelcomeEmailProps) => {
  const firstName = userName?.trim().split(" ")[0];
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";

  return (
    <Html lang="en">
      <Head />
      <Tailwind config={{ presets: [pixelBasedPreset] }}>
        <Body className="bg-[#F9F9F9] font-sans">
          <Preview>Welcome — you&apos;re all set</Preview>
          <Container className="max-w-[580px] my-[30px] mx-auto bg-white">
            <Section className="pt-[5px] px-5 pb-[10px]">
              <Text className="text-[14px] leading-[1.5]">{greeting}</Text>
              <Text className="text-[14px] leading-[1.5]">
                Thanks for signing up. You&apos;re all set — we&apos;re glad to have you on board.
              </Text>
              {baseUrl ? (
                <Button
                  href={baseUrl}
                  className="text-[14px] bg-[#007cba] text-white leading-normal rounded-lg py-3 px-6 box-border block text-center no-underline"
                >
                  Get started
                </Button>
              ) : null}
              <Text className="text-[14px] leading-[1.5]">
                If you have any questions, just reply to this email.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default WelcomeEmail;
