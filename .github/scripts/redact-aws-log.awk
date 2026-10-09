# Drops CloudFormation outputs and replaces account ids and region names.
# Reads CDK log lines on stdin and writes the redacted log on stdout.
function redact_regions(line, out, rest, start) {
  out = ""
  rest = line
  while (match(rest, /(us-gov|us|eu|ap|sa|ca|me|af|il|cn|mx)-(north|south|east|west|central|northeast|southeast|northwest|southwest)-[0-9]/)) {
    start = RSTART
    if (start == 1 || substr(rest, start - 1, 1) !~ /[A-Za-z0-9]/) {
      out = out substr(rest, 1, start - 1) "<region>"
    } else {
      out = out substr(rest, 1, start + RLENGTH - 1)
    }
    rest = substr(rest, start + RLENGTH)
  }
  return out rest
}

function redact(line) {
  gsub(/[0-9]{12}/, "<account>", line)
  return redact_regions(line)
}

{
  plain = $0
  gsub(/\033\[[0-9;]*m/, "", plain)
}

plain == "Outputs:" { hide = 1; next }
plain == "Stack ARN:" { skiparn = 1; next }
skiparn { skiparn = 0; hide = 0; next }
hide { next }
{ print redact(plain); fflush() }
